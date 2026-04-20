import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
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

  const positions = [
    { symbol: "AAPL", qty: 40, cost: 160, sector: "Technology", assetType: "EQUITY" },
    { symbol: "MSFT", qty: 25, cost: 320, sector: "Technology", assetType: "EQUITY" },
    { symbol: "NVDA", qty: 15, cost: 450, sector: "Technology", assetType: "EQUITY" },
    { symbol: "GOOG", qty: 20, cost: 140, sector: "Communication Services", assetType: "EQUITY" },
    { symbol: "AMZN", qty: 18, cost: 145, sector: "Consumer Discretionary", assetType: "EQUITY" },
    { symbol: "JPM", qty: 30, cost: 150, sector: "Financials", assetType: "EQUITY" },
    { symbol: "UNH", qty: 10, cost: 480, sector: "Healthcare", assetType: "EQUITY" },
    { symbol: "XOM", qty: 40, cost: 105, sector: "Energy", assetType: "EQUITY" },
    { symbol: "VWO", qty: 60, cost: 42, sector: "Emerging Markets", assetType: "ETF" },
    { symbol: "TLT", qty: 35, cost: 92, sector: "Long Treasuries", assetType: "ETF" },
    { symbol: "GLD", qty: 20, cost: 180, sector: "Commodities", assetType: "ETF" },
  ];

  for (const p of positions) {
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

  console.log(`Seeded user ${email} / demo1234 with ${positions.length} positions in "${portfolio.name}".`);

  // Backfill fundamentals. Try Yahoo first, fall back to curated static data
  // so the demo works in sandboxed/rate-limited environments.
  console.log("Fetching fundamentals (sector, industry, country, dividends)...");
  const { refreshProfile, countryToRegion } = await import("../src/lib/fundamentals");

  const STATIC_PROFILES: Record<string, {
    name: string; sector: string; industry: string; country: string;
    currency: string; quoteType: string; marketCap: number;
    dividendRate: number; dividendYield: number; payoutFrequency: number;
    exDividendMonth: number; // 0-11, used to project next ex-div date
  }> = {
    AAPL:  { name: "Apple Inc.", sector: "Technology", industry: "Consumer Electronics", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 3.4e12, dividendRate: 1.00, dividendYield: 0.0044, payoutFrequency: 4, exDividendMonth: 1 },
    MSFT:  { name: "Microsoft Corporation", sector: "Technology", industry: "Software—Infrastructure", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 3.1e12, dividendRate: 3.32, dividendYield: 0.0079, payoutFrequency: 4, exDividendMonth: 2 },
    NVDA:  { name: "NVIDIA Corporation", sector: "Technology", industry: "Semiconductors", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 2.8e12, dividendRate: 0.04, dividendYield: 0.0003, payoutFrequency: 4, exDividendMonth: 2 },
    GOOG:  { name: "Alphabet Inc.", sector: "Communication Services", industry: "Internet Content & Information", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 2.1e12, dividendRate: 0.80, dividendYield: 0.0047, payoutFrequency: 4, exDividendMonth: 0 },
    AMZN:  { name: "Amazon.com, Inc.", sector: "Consumer Discretionary", industry: "Internet Retail", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 1.9e12, dividendRate: 0, dividendYield: 0, payoutFrequency: 0, exDividendMonth: 0 },
    JPM:   { name: "JPMorgan Chase & Co.", sector: "Financials", industry: "Banks—Diversified", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 6.1e11, dividendRate: 5.00, dividendYield: 0.024, payoutFrequency: 4, exDividendMonth: 0 },
    UNH:   { name: "UnitedHealth Group", sector: "Healthcare", industry: "Healthcare Plans", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 5.2e11, dividendRate: 8.40, dividendYield: 0.015, payoutFrequency: 4, exDividendMonth: 2 },
    XOM:   { name: "Exxon Mobil Corporation", sector: "Energy", industry: "Oil & Gas Integrated", country: "United States", currency: "USD", quoteType: "EQUITY", marketCap: 4.8e11, dividendRate: 3.96, dividendYield: 0.033, payoutFrequency: 4, exDividendMonth: 1 },
    VWO:   { name: "Vanguard FTSE Emerging Markets ETF", sector: "—", industry: "—", country: "Emerging Markets", currency: "USD", quoteType: "ETF", marketCap: 8.2e10, dividendRate: 1.45, dividendYield: 0.032, payoutFrequency: 4, exDividendMonth: 2 },
    TLT:   { name: "iShares 20+ Year Treasury Bond ETF", sector: "—", industry: "—", country: "United States", currency: "USD", quoteType: "ETF", marketCap: 5.7e10, dividendRate: 3.20, dividendYield: 0.038, payoutFrequency: 12, exDividendMonth: 0 },
    GLD:   { name: "SPDR Gold Shares", sector: "—", industry: "—", country: "United States", currency: "USD", quoteType: "ETF", marketCap: 7.4e10, dividendRate: 0, dividendYield: 0, payoutFrequency: 0, exDividendMonth: 0 },
  };

  let yahooOk = 0;
  let fallback = 0;
  for (const p of positions) {
    process.stdout.write(`  ${p.symbol}... `);
    const ok = await refreshProfile(p.symbol).catch(() => null);
    if (ok) {
      yahooOk++;
      console.log("yahoo");
    } else {
      const s = STATIC_PROFILES[p.symbol];
      if (s) {
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
        fallback++;
        console.log("static fallback");
      } else {
        console.log("skipped");
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`Seed complete. Fundamentals: ${yahooOk} live, ${fallback} static fallback.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
