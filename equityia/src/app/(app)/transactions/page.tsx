import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Topbar } from "@/components/Topbar";
import { TransactionsClient } from "@/components/TransactionsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TransactionsPage() {
  const user = (await requireUser())!;
  const portfolios = await prisma.portfolio.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, baseCurrency: true },
  });
  const txs = await prisma.transaction.findMany({
    where: { portfolio: { userId: user.id } },
    orderBy: { executedAt: "desc" },
    take: 500,
  });

  return (
    <>
      <Topbar title="Transactions" subtitle={`${txs.length} entries · buys, sells, dividends & fees`} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <TransactionsClient
            portfolios={portfolios}
            transactions={txs.map((t) => ({
              id: t.id,
              portfolioId: t.portfolioId,
              symbol: t.symbol,
              type: t.type,
              quantity: t.quantity,
              price: t.price,
              fees: t.fees,
              currency: t.currency,
              executedAt: t.executedAt.toISOString(),
              note: t.note,
            }))}
          />
        </div>
      </main>
    </>
  );
}
