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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
