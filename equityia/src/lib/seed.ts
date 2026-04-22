import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { refreshProfile, countryToRegion } from "./fundamentals";

// Shared seed logic reused by both the CLI (`npm run db:seed`) and the
// /api/admin/seed endpoint used to populate a fresh production database.

const STATIC_PROFILES: Record<string, {
  name: string; sector: string; industry: string; country: string;
  currency: string; quoteType: string; marketCap: number;
  dividendRate: number; dividendYield: number; payoutFrequency: number;
  exDividendMonth: number;
}> = {
  AAPL: { name: "Apple Inc.", sector: "Technology", industry: "Consumer Electronics", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 3.4e12, dividendRate: 1.00, dividendYield: 0.0044, payoutFrequency: 4, exDividendMonth: 1 },
  MSFT: { name: "Microsoft Corporation", sector: "Technology", industry: "Software—Infrastructure", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 3.1e12, dividendRate: 3.32, dividendYield: 0.0079, payoutFrequency: 4, exDividendMonth: 2 },
  NVDA: { name: "NVIDIA Corporation", sector: "Technology", industry: "Semiconductors", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 2.8e12, dividendRate: 0.04, dividendYield: 0.0003, payoutFrequency: 4, exDividendMonth: 2 },
  GOOG: { name: "Alphabet Inc.", sector: "Communication Services", industry: "Internet Content & Information", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 2.1e12, dividendRate: 0.80, dividendYield: 0.0047, payoutFrequency: 4, exDividendMonth: 0 },
  AMZN: { name: "Amazon.com, Inc.", sector: "Consumer Discretionary", industry: "Internet Retail", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 1.9e12, dividendRate: 0, dividendYield: 0, payoutFrequency: 0, exDividendMonth: 0 },
  JPM:  { name: "JPMorgan Chase & Co.", sector: "Financials", industry: "Banks—Diversified", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 6.1e11, dividendRate: 5.00, dividendYield: 0.024, payoutFrequency: 4, exDividendMonth: 0 },
  UNH:  { name: "UnitedHealth Group", sector: "Healthcare", industry: "Healthcare Plans", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 5.2e11, dividendRate: 8.40, dividendYield: 0.015, payoutFrequency: 4, exDividendMonth: 2 },
  XOM:  { name: "Exxon Mobil Corporation", sector: "Energy", industry: "Oil & Gas Integrated", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 4.8e11, dividendRate: 3.96, dividendYield: 0.033, payoutFrequency: 4, exDividendMonth: 1 },
  VWO:  { name: "Vanguard FTSE Emerging Markets ETF", sector: "—", industry: "—", country: "Emerging Markets", currency: "USD", quoteType: "ETF", marketCap: 8.2e10, dividendRate: 1.45, dividendYield: 0.032, payoutFrequency: 4, exDividendMonth: 2 },
  TLT:  { name: "iShares 20+ Year Treasury Bond ETF", sector: "—", industry: "—", country: "United States", currency: "USD", quoteType: "ETF", marketCap: 5.7e10, dividendRate: 3.20, dividendYield: 0.038, payoutFrequency: 12, exDividendMonth: 0 },
  GLD:  { name: "SPDR Gold Shares", sector: "—", industry: "—", country: "United States", currency: "USD", quoteType: "ETF", marketCap: 7.4e10, dividendRate: 0, dividendYield: 0, payoutFrequency: 0, exDividendMonth: 0 },
};

const POSITIONS = [
  { symbol: "AAPL", qty: 40, cost: 160, sector: "Technology", assetType: "EQUITY" },
  { symbol: "MSFT", qty: 25, cost: 320, sector: "Technology", assetType: "EQUITY" },
  { symbol: "NVDA", qty: 15, cost: 450, sector: "Technology", assetType: "EQUITY" },
  { symbol: "GOOG", qty: 20, cost: 140, sector: "Communication Services", assetType: "EQUITY" },
  { symbol: "AMZN", qty: 18, cost: 145, sector: "Consumer Discretionary", assetType: "EQUITY" },
  { symbol: "JPM",  qty: 30, cost: 150, sector: "Financials", assetType: "EQUITY" },
  { symbol: "UNH",  qty: 10, cost: 480, sector: "Healthcare", assetType: "EQUITY" },
  { symbol: "XOM",  qty: 40, cost: 105, sector: "Energy", assetType: "EQUITY" },
  { symbol: "VWO",  qty: 60, cost: 42,  sector: "Emerging Markets", assetType: "ETF" },
  { symbol: "TLT",  qty: 35, cost: 92,  sector: "Long Treasuries", assetType: "ETF" },
  { symbol: "GLD",  qty: 20, cost: 180, sector: "Commodities", assetType: "ETF" },
];

const BUYS = [
  { symbol: "AAPL", quantity: 20, price: 150, fees: 1.0, executedAt: "2023-06-12" },
  { symbol: "AAPL", quantity: 20, price: 170, fees: 1.0, executedAt: "2024-02-08" },
  { symbol: "MSFT", quantity: 15, price: 310, fees: 1.0, executedAt: "2023-09-21" },
  { symbol: "MSFT", quantity: 10, price: 335, fees: 1.0, executedAt: "2024-05-03" },
  { symbol: "NVDA", quantity: 15, price: 450, fees: 1.5, executedAt: "2023-11-15" },
  { symbol: "GOOG", quantity: 20, price: 140, fees: 1.0, executedAt: "2024-01-18" },
  { symbol: "AMZN", quantity: 18, price: 145, fees: 1.0, executedAt: "2024-04-10" },
  { symbol: "JPM",  quantity: 30, price: 150, fees: 1.5, executedAt: "2023-10-05" },
  { symbol: "UNH",  quantity: 10, price: 480, fees: 1.5, executedAt: "2024-03-14" },
  { symbol: "XOM",  quantity: 40, price: 105, fees: 1.5, executedAt: "2024-06-20" },
  { symbol: "VWO",  quantity: 60, price: 42,  fees: 1.0, executedAt: "2024-07-11" },
  { symbol: "TLT",  quantity: 35, price: 92,  fees: 1.0, executedAt: "2024-08-02" },
  { symbol: "GLD",  quantity: 20, price: 180, fees: 1.0, executedAt: "2024-09-18" },
];

const DIVS = [
  { symbol: "AAPL", amount: 10.0, date: "2026-02-13", note: "Q1 2026" },
  { symbol: "MSFT", amount: 20.75, date: "2026-03-14", note: "Q1 2026" },
  { symbol: "JPM",  amount: 37.50, date: "2026-01-31", note: "Q4 2025 payout" },
  { symbol: "JPM",  amount: 37.50, date: "2026-04-30", note: "Q1 2026" },
  { symbol: "UNH",  amount: 21.00, date: "2026-03-18", note: "Q1 2026" },
  { symbol: "XOM",  amount: 39.60, date: "2026-03-10", note: "Q1 2026" },
  { symbol: "TLT",  amount: 9.33,  date: "2026-01-09" },
  { symbol: "TLT",  amount: 9.33,  date: "2026-02-09" },
  { symbol: "TLT",  amount: 9.33,  date: "2026-03-10" },
  { symbol: "VWO",  amount: 21.75, date: "2026-03-25", note: "Q1 2026" },
];

export type SeedReport = {
  user: string;
  portfolio: string;
  positions: number;
  fundamentals: { live: number; static: number };
  transactions: { buys: number; dividends: number };
  receivedYtd: number;
};

export async function seedDemo(opts: { tryYahoo?: boolean } = {}): Promise<SeedReport> {
  const tryYahoo = opts.tryYahoo ?? true;
  const email = "demo@equityia.app";
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: "Demo User" },
  });

  let portfolio = await prisma.portfolio.findFirst({
    where: { userId: user.id, name: "Core Allocation" },
  });
  if (!portfolio) {
    portfolio = await prisma.portfolio.create({
      data: { userId: user.id, name: "Core Allocation", baseCurrency: "USD" },
    });
  }

  for (const p of POSITIONS) {
    await prisma.position.upsert({
      where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol: p.symbol } },
      update: { quantity: p.qty, avgCost: p.cost, sector: p.sector, assetType: p.assetType },
      create: {
        portfolioId: portfolio.id,
        symbol: p.symbol,
        quantity: p.qty,
        avgCost: p.cost,
        sector: p.sector,
        assetType: p.assetType,
        currency: "USD",
      },
    });
  }

  let live = 0;
  let staticCount = 0;
  for (const p of POSITIONS) {
    const ok = tryYahoo ? await refreshProfile(p.symbol).catch(() => null) : null;
    if (ok) {
      live++;
    } else {
      const s = STATIC_PROFILES[p.symbol];
      if (!s) continue;
      const nextEx = new Date();
      nextEx.setMonth(s.exDividendMonth);
      if (nextEx < new Date()) nextEx.setFullYear(nextEx.getFullYear() + 1);
      await prisma.symbolProfile.upsert({
        where: { symbol: p.symbol },
        update: {
          name: s.name, sector: s.sector, industry: s.industry,
          country: s.country, region: countryToRegion(s.country),
          currency: s.currency, quoteType: s.quoteType,
          marketCap: s.marketCap,
          dividendRate: s.dividendRate, dividendYield: s.dividendYield,
          payoutFrequency: s.payoutFrequency || null,
          exDividendDate: s.dividendRate > 0 ? nextEx : null,
          nextDividendDate: s.dividendRate > 0 ? nextEx : null,
        },
        create: {
          symbol: p.symbol,
          name: s.name, sector: s.sector, industry: s.industry,
          country: s.country, region: countryToRegion(s.country),
          currency: s.currency, quoteType: s.quoteType,
          marketCap: s.marketCap,
          dividendRate: s.dividendRate, dividendYield: s.dividendYield,
          payoutFrequency: s.payoutFrequency || null,
          exDividendDate: s.dividendRate > 0 ? nextEx : null,
          nextDividendDate: s.dividendRate > 0 ? nextEx : null,
        },
      });
      staticCount++;
    }
  }

  await prisma.transaction.deleteMany({ where: { portfolioId: portfolio.id } });
  for (const b of BUYS) {
    await prisma.transaction.create({
      data: {
        portfolioId: portfolio.id,
        symbol: b.symbol, type: "BUY",
        quantity: b.quantity, price: b.price, fees: b.fees,
        currency: "USD", executedAt: new Date(b.executedAt),
      },
    });
  }
  for (const dv of DIVS) {
    await prisma.transaction.create({
      data: {
        portfolioId: portfolio.id,
        symbol: dv.symbol, type: "DIVIDEND",
        quantity: 1, price: dv.amount, fees: 0,
        currency: "USD", executedAt: new Date(dv.date),
        note: dv.note,
      },
    });
  }
  const receivedYtd = DIVS.reduce((s, d) => s + d.amount, 0);

  return {
    user: email,
    portfolio: portfolio.name,
    positions: POSITIONS.length,
    fundamentals: { live, static: staticCount },
    transactions: { buys: BUYS.length, dividends: DIVS.length },
    receivedYtd,
  };
}
