import type { SymbolProfile } from "@prisma/client";
import { prisma } from "./prisma";
import { getProfiles } from "./fundamentals";

export type DividendPosition = {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  marketValue: number;
  costBasis: number;
  dividendRate: number; // forward annual per share
  dividendYield: number; // current yield (0..1)
  yieldOnCost: number;
  forwardAnnualIncome: number;
  payoutFrequency: number;
  nextDate?: Date;
  exDate?: Date;
  fiveYearAvgYield?: number;
  payoutRatio?: number;
};

export type UpcomingDividend = {
  symbol: string;
  name: string;
  date: Date; // projected payment date
  amountPerShare: number;
  totalAmount: number;
  isProjected: boolean;
};

export type DividendSummary = {
  forwardAnnualIncome: number;
  totalMarketValue: number;
  portfolioYield: number; // weighted current yield
  weightedYieldOnCost: number;
  projectedMonthly: { month: string; amount: number }[]; // next 12 months
  upcoming: UpcomingDividend[];
  positions: DividendPosition[];
};

type PortfolioContext = {
  positions: {
    id: string;
    symbol: string;
    quantity: number;
    avgCost: number;
    price: number;
    marketValue: number;
    name?: string;
  }[];
};

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildProjectedDates(profile: SymbolProfile, horizonMonths = 12): Date[] {
  const freq = profile.payoutFrequency ?? 4;
  const today = new Date();
  const anchor =
    profile.nextDividendDate ??
    (profile.exDividendDate
      ? addMonths(profile.exDividendDate, Math.round(12 / freq))
      : undefined);
  if (!anchor) return [];
  // Advance anchor forward to today if needed.
  let next = new Date(anchor);
  const stepMonths = Math.max(1, Math.round(12 / freq));
  while (next < today) next = addMonths(next, stepMonths);
  const out: Date[] = [];
  const horizon = addMonths(today, horizonMonths);
  while (next <= horizon) {
    out.push(new Date(next));
    next = addMonths(next, stepMonths);
  }
  return out;
}

export async function buildDividendSummary(ctx: PortfolioContext): Promise<DividendSummary> {
  const symbols = ctx.positions.map((p) => p.symbol);
  const profiles = await getProfiles(symbols);

  const positions: DividendPosition[] = [];
  const upcoming: UpcomingDividend[] = [];
  const monthlyMap = new Map<string, number>();
  const today = new Date();
  for (let i = 0; i < 12; i++) monthlyMap.set(monthKey(addMonths(today, i)), 0);

  let forwardAnnualIncome = 0;
  let totalMarketValue = 0;
  let yieldOnCostNumerator = 0;

  for (const p of ctx.positions) {
    const prof = profiles[p.symbol.toUpperCase()];
    totalMarketValue += p.marketValue;
    const dividendRate = prof?.dividendRate ?? 0;
    const dividendYield = prof?.dividendYield ?? 0;
    const forward = dividendRate * p.quantity;
    forwardAnnualIncome += forward;
    yieldOnCostNumerator += (p.avgCost > 0 ? dividendRate / p.avgCost : 0) * p.marketValue;
    const freq = prof?.payoutFrequency ?? 4;

    positions.push({
      symbol: p.symbol,
      name: p.name ?? prof?.name ?? p.symbol,
      quantity: p.quantity,
      price: p.price,
      marketValue: p.marketValue,
      costBasis: p.avgCost * p.quantity,
      dividendRate,
      dividendYield,
      yieldOnCost: p.avgCost > 0 ? dividendRate / p.avgCost : 0,
      forwardAnnualIncome: forward,
      payoutFrequency: freq,
      nextDate: prof?.nextDividendDate ?? undefined,
      exDate: prof?.exDividendDate ?? undefined,
      fiveYearAvgYield: prof?.fiveYearAvgYield ?? undefined,
      payoutRatio: prof?.payoutRatio ?? undefined,
    });

    if (!prof || !dividendRate) continue;
    const perPayment = dividendRate / freq;
    const dates = buildProjectedDates(prof, 12);
    for (const d of dates) {
      const amt = perPayment * p.quantity;
      const k = monthKey(d);
      if (monthlyMap.has(k)) monthlyMap.set(k, (monthlyMap.get(k) ?? 0) + amt);
      upcoming.push({
        symbol: p.symbol,
        name: p.name ?? prof.name ?? p.symbol,
        date: d,
        amountPerShare: perPayment,
        totalAmount: amt,
        isProjected: true,
      });
    }
  }

  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());

  const projectedMonthly = Array.from(monthlyMap.entries()).map(([month, amount]) => ({
    month,
    amount,
  }));

  return {
    forwardAnnualIncome,
    totalMarketValue,
    portfolioYield: totalMarketValue > 0 ? forwardAnnualIncome / totalMarketValue : 0,
    weightedYieldOnCost: totalMarketValue > 0 ? yieldOnCostNumerator / totalMarketValue : 0,
    projectedMonthly,
    upcoming: upcoming.slice(0, 40),
    positions,
  };
}

export async function aggregateDividendSummaryForUser(userId: string) {
  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    include: { positions: true },
  });
  const flat = portfolios.flatMap((p) => p.positions);
  // Aggregate by symbol.
  const bySymbol = new Map<string, { symbol: string; quantity: number; avgCost: number }>();
  for (const pos of flat) {
    const cur = bySymbol.get(pos.symbol);
    if (cur) {
      const newQty = cur.quantity + pos.quantity;
      cur.avgCost = (cur.avgCost * cur.quantity + pos.avgCost * pos.quantity) / newQty;
      cur.quantity = newQty;
    } else {
      bySymbol.set(pos.symbol, {
        symbol: pos.symbol,
        quantity: pos.quantity,
        avgCost: pos.avgCost,
      });
    }
  }
  // Need market values — fetch via market.ts indirectly.
  const { getQuotes } = await import("./market");
  const quotes = await getQuotes(Array.from(bySymbol.keys()));
  const positions = Array.from(bySymbol.values()).map((p) => {
    const q = quotes[p.symbol.toUpperCase()];
    const price = q?.price ?? p.avgCost;
    return {
      id: p.symbol,
      symbol: p.symbol,
      quantity: p.quantity,
      avgCost: p.avgCost,
      price,
      marketValue: price * p.quantity,
      name: q?.name,
    };
  });
  return buildDividendSummary({ positions });
}
