import yahooFinance from "yahoo-finance2";
import { prisma } from "./prisma";

// Silence noisy survey/notice logs from yahoo-finance2.
(yahooFinance as unknown as { suppressNotices?: (n: string[]) => void }).suppressNotices?.([
  "yahooSurvey",
]);

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
  exchange?: string;
  sector?: string;
  marketCap?: number;
  previousClose?: number;
};

const quoteCache = new Map<string, { at: number; data: Quote }>();
const QUOTE_TTL_MS = 60_000;

export async function getQuote(symbol: string): Promise<Quote | null> {
  const up = symbol.toUpperCase();
  const cached = quoteCache.get(up);
  if (cached && Date.now() - cached.at < QUOTE_TTL_MS) return cached.data;

  try {
    const q = await yahooFinance.quote(up);
    if (!q || typeof q.regularMarketPrice !== "number") return null;
    const data: Quote = {
      symbol: up,
      name: q.longName || q.shortName || up,
      price: q.regularMarketPrice,
      change: q.regularMarketChange ?? 0,
      changePct: (q.regularMarketChangePercent ?? 0) / 100,
      currency: q.currency ?? "USD",
      exchange: q.fullExchangeName ?? q.exchange,
      marketCap: q.marketCap ?? undefined,
      previousClose: q.regularMarketPreviousClose ?? undefined,
    };
    quoteCache.set(up, { at: Date.now(), data });
    return data;
  } catch (e) {
    console.error("getQuote error", up, e);
    return null;
  }
}

export async function getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const out: Record<string, Quote> = {};
  await Promise.all(
    unique.map(async (s) => {
      const q = await getQuote(s);
      if (q) out[s] = q;
    })
  );
  return out;
}

export type HistoricalPoint = { date: Date; close: number };

export async function getHistorical(
  symbol: string,
  period: "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" = "1y"
): Promise<HistoricalPoint[]> {
  const up = symbol.toUpperCase();
  const now = new Date();
  const period1 = new Date(now);
  const daysMap = { "1mo": 31, "3mo": 93, "6mo": 186, "1y": 370, "2y": 740, "5y": 1830 };
  period1.setDate(now.getDate() - daysMap[period]);

  try {
    const rows = await yahooFinance.chart(up, {
      period1,
      period2: now,
      interval: "1d",
    });
    const quotes = rows?.quotes ?? [];
    return quotes
      .filter((r) => r.close != null && r.date)
      .map((r) => ({ date: new Date(r.date), close: r.close as number }));
  } catch (e) {
    console.error("getHistorical error", up, e);
    return [];
  }
}

export async function cachedHistorical(symbol: string, period: "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" = "1y") {
  const sym = symbol.toUpperCase();
  const data = await getHistorical(symbol, period);
  if (data.length > 0) {
    await Promise.all(
      data.map((p) =>
        prisma.priceSnapshot
          .upsert({
            where: { symbol_date: { symbol: sym, date: p.date } },
            update: { close: p.close },
            create: { symbol: sym, date: p.date, close: p.close },
          })
          .catch(() => null)
      )
    );
    return data;
  }
  // Fallback: if the live fetch failed (e.g. rate-limited sandbox), serve
  // whatever we already have cached in PriceSnapshot for this period.
  const daysMap = { "1mo": 31, "3mo": 93, "6mo": 186, "1y": 370, "2y": 740, "5y": 1830 };
  const since = new Date();
  since.setDate(since.getDate() - daysMap[period]);
  const cached = await prisma.priceSnapshot.findMany({
    where: { symbol: sym, date: { gte: since } },
    orderBy: { date: "asc" },
  });
  return cached.map((c) => ({ date: c.date, close: c.close }));
}

// Fetch historical bars for a specific [from, to] window. Tries yahoo first,
// falls back to whatever is cached in PriceSnapshot for that window.
export async function historicalBetween(
  symbol: string,
  from: Date,
  to: Date
): Promise<HistoricalPoint[]> {
  const sym = symbol.toUpperCase();
  try {
    const rows = await yahooFinance.chart(sym, { period1: from, period2: to, interval: "1d" });
    const quotes = rows?.quotes ?? [];
    const live = quotes
      .filter((r) => r.close != null && r.date)
      .map((r) => ({ date: new Date(r.date), close: r.close as number }));
    if (live.length > 0) {
      await Promise.all(
        live.map((p) =>
          prisma.priceSnapshot
            .upsert({
              where: { symbol_date: { symbol: sym, date: p.date } },
              update: { close: p.close },
              create: { symbol: sym, date: p.date, close: p.close },
            })
            .catch(() => null)
        )
      );
      return live;
    }
  } catch {
    // fall through to DB cache
  }
  const cached = await prisma.priceSnapshot.findMany({
    where: { symbol: sym, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
  return cached.map((c) => ({ date: c.date, close: c.close }));
}

type SearchQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  quoteType?: string;
};

export async function searchSymbols(
  query: string
): Promise<{ symbol: string; name: string; exchange?: string; type?: string }[]> {
  if (!query || query.length < 1) return [];
  try {
    const res = await yahooFinance.search(query, { quotesCount: 10, newsCount: 0 });
    const quotes = (res.quotes ?? []) as SearchQuote[];
    return quotes
      .filter((q): q is SearchQuote & { symbol: string } => !!q.symbol)
      .map((q) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange,
        type: q.quoteType,
      }));
  } catch (e) {
    console.error("searchSymbols error", e);
    return [];
  }
}
