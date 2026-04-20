import yahooFinance from "yahoo-finance2";
import { prisma } from "./prisma";

const PROFILE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DIVIDENDS_TTL_MS = 24 * 60 * 60 * 1000;

export type Region =
  | "North America"
  | "Europe"
  | "Asia Pacific"
  | "Latin America"
  | "Middle East & Africa"
  | "Emerging Markets"
  | "Global"
  | "Unclassified";

const COUNTRY_TO_REGION: Record<string, Region> = {
  "United States": "North America",
  "United States of America": "North America",
  Canada: "North America",
  Mexico: "Latin America",
  Brazil: "Latin America",
  Argentina: "Latin America",
  Chile: "Latin America",
  Colombia: "Latin America",

  "United Kingdom": "Europe",
  Germany: "Europe",
  France: "Europe",
  Spain: "Europe",
  Italy: "Europe",
  Netherlands: "Europe",
  Switzerland: "Europe",
  Sweden: "Europe",
  Norway: "Europe",
  Finland: "Europe",
  Denmark: "Europe",
  Ireland: "Europe",
  Belgium: "Europe",
  Austria: "Europe",
  Portugal: "Europe",
  Poland: "Europe",
  Greece: "Europe",

  China: "Asia Pacific",
  "Hong Kong": "Asia Pacific",
  Taiwan: "Asia Pacific",
  Japan: "Asia Pacific",
  "South Korea": "Asia Pacific",
  India: "Asia Pacific",
  Singapore: "Asia Pacific",
  Australia: "Asia Pacific",
  "New Zealand": "Asia Pacific",
  Indonesia: "Asia Pacific",
  Thailand: "Asia Pacific",
  Malaysia: "Asia Pacific",
  Philippines: "Asia Pacific",
  Vietnam: "Asia Pacific",

  "Saudi Arabia": "Middle East & Africa",
  "United Arab Emirates": "Middle East & Africa",
  Israel: "Middle East & Africa",
  Turkey: "Middle East & Africa",
  "South Africa": "Middle East & Africa",
  Egypt: "Middle East & Africa",
  Nigeria: "Middle East & Africa",
};

export function countryToRegion(country?: string | null): Region {
  if (!country) return "Unclassified";
  return COUNTRY_TO_REGION[country] ?? "Unclassified";
}

type QuoteSummary = {
  assetProfile?: {
    sector?: string;
    industry?: string;
    country?: string;
    longBusinessSummary?: string;
    website?: string;
  };
  summaryDetail?: {
    dividendRate?: number;
    dividendYield?: number;
    trailingAnnualDividendRate?: number;
    trailingAnnualDividendYield?: number;
    exDividendDate?: Date;
    payoutRatio?: number;
    fiveYearAvgDividendYield?: number;
    marketCap?: number;
  };
  calendarEvents?: {
    exDividendDate?: Date;
    dividendDate?: Date;
  };
  price?: {
    currency?: string;
    exchange?: string;
    exchangeName?: string;
    quoteType?: string;
    longName?: string;
    shortName?: string;
  };
};

function inferPayoutFrequency(dividendDates: Date[]): number | undefined {
  if (dividendDates.length < 2) return undefined;
  const sorted = [...dividendDates].sort((a, b) => a.getTime() - b.getTime());
  const recent = sorted.slice(-8);
  if (recent.length < 2) return undefined;
  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    gaps.push((recent[i].getTime() - recent[i - 1].getTime()) / 86_400_000);
  }
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (avgGap < 45) return 12; // monthly
  if (avgGap < 120) return 4; // quarterly
  if (avgGap < 240) return 2; // semi-annual
  return 1;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = (e as Error).message ?? String(e);
      const rateLimited = /Too Many Requests|429/i.test(msg);
      if (!rateLimited && i > 0) throw e;
      await new Promise((r) => setTimeout(r, 800 * Math.pow(2, i) + Math.random() * 400));
    }
  }
  throw lastErr;
}

export async function refreshProfile(symbol: string) {
  const sym = symbol.toUpperCase();
  try {
    const qs = (await withRetry(() =>
      yahooFinance.quoteSummary(sym, {
        modules: ["assetProfile", "summaryDetail", "calendarEvents", "price"],
      })
    )) as QuoteSummary;

    // Recent dividends (for frequency inference + UI).
    let dividendDates: Date[] = [];
    try {
      const hist = (await withRetry(() =>
        yahooFinance.historical(sym, {
          period1: new Date(Date.now() - 5 * 365 * 86_400_000),
          period2: new Date(),
          events: "dividends",
        })
      )) as Array<{ date: Date; dividends?: number }>;
      const events = hist.filter((h) => typeof h.dividends === "number" && (h.dividends as number) > 0);
      dividendDates = events.map((h) => h.date);
      await Promise.all(
        events.map((h) =>
          prisma.dividendEvent
            .upsert({
              where: { symbol_date: { symbol: sym, date: h.date } },
              update: { amount: h.dividends as number },
              create: {
                symbol: sym,
                date: h.date,
                amount: h.dividends as number,
                currency: qs.price?.currency ?? "USD",
              },
            })
            .catch(() => null)
        )
      );
    } catch {
      // symbol may not have dividend history (e.g. crypto, growth stock)
    }

    const freq = inferPayoutFrequency(dividendDates);
    const nextDiv = qs.calendarEvents?.dividendDate ?? null;
    const exDiv = qs.calendarEvents?.exDividendDate ?? qs.summaryDetail?.exDividendDate ?? null;

    const profile = await prisma.symbolProfile.upsert({
      where: { symbol: sym },
      update: {
        name: qs.price?.longName ?? qs.price?.shortName,
        currency: qs.price?.currency,
        exchange: qs.price?.exchangeName ?? qs.price?.exchange,
        quoteType: qs.price?.quoteType,
        sector: qs.assetProfile?.sector,
        industry: qs.assetProfile?.industry,
        country: qs.assetProfile?.country,
        region: countryToRegion(qs.assetProfile?.country),
        marketCap: qs.summaryDetail?.marketCap,
        dividendRate: qs.summaryDetail?.dividendRate ?? qs.summaryDetail?.trailingAnnualDividendRate,
        dividendYield: qs.summaryDetail?.dividendYield ?? qs.summaryDetail?.trailingAnnualDividendYield,
        exDividendDate: exDiv,
        nextDividendDate: nextDiv,
        payoutFrequency: freq,
        fiveYearAvgYield: qs.summaryDetail?.fiveYearAvgDividendYield
          ? qs.summaryDetail.fiveYearAvgDividendYield / 100
          : undefined,
        payoutRatio: qs.summaryDetail?.payoutRatio,
      },
      create: {
        symbol: sym,
        name: qs.price?.longName ?? qs.price?.shortName,
        currency: qs.price?.currency,
        exchange: qs.price?.exchangeName ?? qs.price?.exchange,
        quoteType: qs.price?.quoteType,
        sector: qs.assetProfile?.sector,
        industry: qs.assetProfile?.industry,
        country: qs.assetProfile?.country,
        region: countryToRegion(qs.assetProfile?.country),
        marketCap: qs.summaryDetail?.marketCap,
        dividendRate: qs.summaryDetail?.dividendRate ?? qs.summaryDetail?.trailingAnnualDividendRate,
        dividendYield: qs.summaryDetail?.dividendYield ?? qs.summaryDetail?.trailingAnnualDividendYield,
        exDividendDate: exDiv,
        nextDividendDate: nextDiv,
        payoutFrequency: freq,
        fiveYearAvgYield: qs.summaryDetail?.fiveYearAvgDividendYield
          ? qs.summaryDetail.fiveYearAvgDividendYield / 100
          : undefined,
        payoutRatio: qs.summaryDetail?.payoutRatio,
      },
    });
    return profile;
  } catch (e) {
    console.error("refreshProfile error", symbol, e);
    return null;
  }
}

export async function getProfile(symbol: string) {
  const sym = symbol.toUpperCase();
  const existing = await prisma.symbolProfile.findUnique({ where: { symbol: sym } });
  if (existing && Date.now() - existing.updatedAt.getTime() < PROFILE_TTL_MS) {
    return existing;
  }
  return (await refreshProfile(sym)) ?? existing;
}

export async function getProfiles(symbols: string[]) {
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const profiles = await Promise.all(unique.map((s) => getProfile(s)));
  const out: Record<string, NonNullable<Awaited<ReturnType<typeof getProfile>>>> = {};
  profiles.forEach((p, i) => {
    if (p) out[unique[i]] = p;
  });
  return out;
}

export async function getDividendHistory(symbol: string) {
  const sym = symbol.toUpperCase();
  const events = await prisma.dividendEvent.findMany({
    where: { symbol: sym },
    orderBy: { date: "desc" },
    take: 40,
  });
  // Refresh if stale or empty
  const newest = events[0]?.date?.getTime() ?? 0;
  if (events.length === 0 || Date.now() - newest > DIVIDENDS_TTL_MS) {
    await refreshProfile(sym);
    return prisma.dividendEvent.findMany({
      where: { symbol: sym },
      orderBy: { date: "desc" },
      take: 40,
    });
  }
  return events;
}
