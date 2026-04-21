import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Demo transactions on top of the baseline seed. Logs: historical BUY lots
// for a few holdings + a handful of DIVIDEND receipts spread across YTD.
// Does NOT mutate Position rows (those are already correct from the main seed);
// purely for populating /transactions and the "Received YTD" KPI.
async function main() {
  const user = await prisma.user.findUnique({ where: { email: "demo@equityia.app" } });
  if (!user) throw new Error("Run `npm run db:seed` first");
  const portfolio = await prisma.portfolio.findFirst({
    where: { userId: user.id, name: "Core Allocation" },
  });
  if (!portfolio) throw new Error("Core Allocation portfolio missing");

  // Wipe any previous demo transactions.
  await prisma.transaction.deleteMany({ where: { portfolioId: portfolio.id } });

  const pid = portfolio.id;
  const d = (iso: string) => new Date(iso);

  const buys = [
    { symbol: "AAPL", quantity: 20, price: 150, fees: 1.0, executedAt: d("2023-06-12") },
    { symbol: "AAPL", quantity: 20, price: 170, fees: 1.0, executedAt: d("2024-02-08") },
    { symbol: "MSFT", quantity: 15, price: 310, fees: 1.0, executedAt: d("2023-09-21") },
    { symbol: "MSFT", quantity: 10, price: 335, fees: 1.0, executedAt: d("2024-05-03") },
    { symbol: "NVDA", quantity: 15, price: 450, fees: 1.5, executedAt: d("2023-11-15") },
    { symbol: "GOOG", quantity: 20, price: 140, fees: 1.0, executedAt: d("2024-01-18") },
    { symbol: "AMZN", quantity: 18, price: 145, fees: 1.0, executedAt: d("2024-04-10") },
    { symbol: "JPM", quantity: 30, price: 150, fees: 1.5, executedAt: d("2023-10-05") },
    { symbol: "UNH", quantity: 10, price: 480, fees: 1.5, executedAt: d("2024-03-14") },
    { symbol: "XOM", quantity: 40, price: 105, fees: 1.5, executedAt: d("2024-06-20") },
    { symbol: "VWO", quantity: 60, price: 42, fees: 1.0, executedAt: d("2024-07-11") },
    { symbol: "TLT", quantity: 35, price: 92, fees: 1.0, executedAt: d("2024-08-02") },
    { symbol: "GLD", quantity: 20, price: 180, fees: 1.0, executedAt: d("2024-09-18") },
  ];

  for (const b of buys) {
    await prisma.transaction.create({
      data: {
        portfolioId: pid,
        symbol: b.symbol,
        type: "BUY",
        quantity: b.quantity,
        price: b.price,
        fees: b.fees,
        currency: "USD",
        executedAt: b.executedAt,
      },
    });
  }

  const divs = [
    { symbol: "AAPL", amount: 10.0, date: d("2026-02-13"), note: "Q1 2026" },
    { symbol: "MSFT", amount: 20.75, date: d("2026-03-14"), note: "Q1 2026" },
    { symbol: "JPM",  amount: 37.50, date: d("2026-01-31"), note: "Q4 2025 payout" },
    { symbol: "JPM",  amount: 37.50, date: d("2026-04-30"), note: "Q1 2026" },
    { symbol: "UNH",  amount: 21.00, date: d("2026-03-18"), note: "Q1 2026" },
    { symbol: "XOM",  amount: 39.60, date: d("2026-03-10"), note: "Q1 2026" },
    { symbol: "TLT",  amount: 9.33,  date: d("2026-01-09") },
    { symbol: "TLT",  amount: 9.33,  date: d("2026-02-09") },
    { symbol: "TLT",  amount: 9.33,  date: d("2026-03-10") },
    { symbol: "VWO",  amount: 21.75, date: d("2026-03-25"), note: "Q1 2026" },
  ];

  for (const dv of divs) {
    await prisma.transaction.create({
      data: {
        portfolioId: pid,
        symbol: dv.symbol,
        type: "DIVIDEND",
        quantity: 1,
        price: dv.amount,
        fees: 0,
        currency: "USD",
        executedAt: dv.date,
        note: dv.note,
      },
    });
  }

  console.log(`Seeded ${buys.length} BUY + ${divs.length} DIVIDEND transactions.`);
  const ytd = divs.reduce((s, d) => s + d.amount, 0);
  console.log(`Received YTD: $${ytd.toFixed(2)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
