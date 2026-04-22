import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../src/lib/seed";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo data...");
  const report = await seedDemo();
  console.log(
    `✓ ${report.positions} positions, ${report.transactions.buys} buys, ` +
    `${report.transactions.dividends} dividends ($${report.receivedYtd.toFixed(2)} YTD), ` +
    `fundamentals: ${report.fundamentals.live} live + ${report.fundamentals.static} static.`
  );
  console.log(`Login: ${report.user} / demo1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
