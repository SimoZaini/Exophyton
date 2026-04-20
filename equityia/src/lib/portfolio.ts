import { prisma } from "./prisma";
import { getQuotes, cachedHistorical, type Quote } from "./market";
import {
  computeRiskSummary,
  dailyReturns,
  portfolioValueSeries,
  type RiskSummary,
  type Series,
} from "./analytics";

export type EnrichedPosition = {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
  quantity: number;
  avgCost: number;
  costBasis: number;
  price: number;
  marketValue: number;
  changePct: number;
  dayChange: number;
  pnl: number;
  pnlPct: number;
  weight: number;
  currency: string;
  sector?: string | null;
};

export type PortfolioSummary = {
  id: string;
  name: string;
  baseCurrency: string;
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPct: number;
  dayChange: number;
  dayChangePct: number;
  positions: EnrichedPosition[];
  allocationByAsset: { label: string; value: number; pct: number }[];
  allocationBySector: { label: string; value: number; pct: number }[];
};

export async function getEnrichedPortfolio(portfolioId: string): Promise<PortfolioSummary | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { positions: true },
  });
  if (!portfolio) return null;

  const symbols = portfolio.positions.map((p) => p.symbol);
  const quotes = symbols.length ? await getQuotes(symbols) : {};

  const enriched: EnrichedPosition[] = portfolio.positions.map((p) => {
    const q: Quote | undefined = quotes[p.symbol.toUpperCase()];
    const price = q?.price ?? p.avgCost;
    const marketValue = price * p.quantity;
    const costBasis = p.avgCost * p.quantity;
    const pnl = marketValue - costBasis;
    const pnlPct = costBasis > 0 ? pnl / costBasis : 0;
    return {
      id: p.id,
      symbol: p.symbol,
      name: q?.name ?? p.symbol,
      assetType: p.assetType,
      quantity: p.quantity,
      avgCost: p.avgCost,
      costBasis,
      price,
      marketValue,
      changePct: q?.changePct ?? 0,
      dayChange: (q?.change ?? 0) * p.quantity,
      pnl,
      pnlPct,
      weight: 0,
      currency: p.currency,
      sector: p.sector,
    };
  });

  const totalValue = enriched.reduce((a, b) => a + b.marketValue, 0);
  const totalCost = enriched.reduce((a, b) => a + b.costBasis, 0);
  const dayChange = enriched.reduce((a, b) => a + b.dayChange, 0);
  for (const e of enriched) e.weight = totalValue > 0 ? e.marketValue / totalValue : 0;

  const byAsset = new Map<string, number>();
  const bySector = new Map<string, number>();
  for (const e of enriched) {
    byAsset.set(e.assetType, (byAsset.get(e.assetType) ?? 0) + e.marketValue);
    const sec = e.sector ?? "Unclassified";
    bySector.set(sec, (bySector.get(sec) ?? 0) + e.marketValue);
  }
  const toAlloc = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([label, value]) => ({ label, value, pct: totalValue > 0 ? value / totalValue : 0 }))
      .sort((a, b) => b.value - a.value);

  const prevValue = totalValue - dayChange;

  return {
    id: portfolio.id,
    name: portfolio.name,
    baseCurrency: portfolio.baseCurrency,
    totalValue,
    totalCost,
    totalPnL: totalValue - totalCost,
    totalPnLPct: totalCost > 0 ? (totalValue - totalCost) / totalCost : 0,
    dayChange,
    dayChangePct: prevValue > 0 ? dayChange / prevValue : 0,
    positions: enriched,
    allocationByAsset: toAlloc(byAsset),
    allocationBySector: toAlloc(bySector),
  };
}

export type PortfolioHistory = {
  series: Series;
  risk: RiskSummary;
  benchmark?: Series;
};

export async function getPortfolioHistory(
  portfolioId: string,
  period: "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" = "1y",
  benchmarkSymbol = "SPY"
): Promise<PortfolioHistory | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { positions: true },
  });
  if (!portfolio) return null;

  const priceSeries: Record<string, { date: Date; close: number }[]> = {};
  await Promise.all(
    portfolio.positions.map(async (p) => {
      const hist = await cachedHistorical(p.symbol, period);
      priceSeries[p.symbol] = hist.map((h) => ({ date: h.date, close: h.close }));
    })
  );

  const series = portfolioValueSeries(
    portfolio.positions.map((p) => ({ symbol: p.symbol, quantity: p.quantity })),
    priceSeries
  );

  const benchHist = await cachedHistorical(benchmarkSymbol, period);
  const benchSeries: Series = benchHist.map((h) => ({ date: h.date, value: h.close }));
  const benchRets = dailyReturns(benchSeries);

  const risk = computeRiskSummary(series, benchRets);
  return { series, risk, benchmark: benchSeries };
}
