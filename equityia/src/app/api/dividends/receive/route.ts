import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { applyTransaction } from "@/lib/transactions";

const schema = z.object({
  symbol: z.string().min(1).max(20),
  portfolioId: z.string().optional(),
  amount: z.coerce.number().positive(), // total cash received in base currency
  date: z.coerce.date().optional(),
  currency: z.string().length(3).default("USD"),
  note: z.string().max(500).optional(),
});

// Log a received dividend as a DIVIDEND transaction. We encode the total
// cash amount as `quantity=1, price=amount` so that sum(qty*price) reflects
// cash received (reused by dividendsReceivedBetween).
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;
  const symbol = data.symbol.toUpperCase();

  // Resolve portfolio: use provided one (must belong to user) or pick the
  // portfolio that actually holds this symbol.
  let portfolioId = data.portfolioId;
  if (portfolioId) {
    const owned = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId: user.id },
    });
    if (!owned) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  } else {
    const pos = await prisma.position.findFirst({
      where: { symbol, portfolio: { userId: user.id } },
      include: { portfolio: true },
    });
    if (!pos) return NextResponse.json({ error: `No position on ${symbol}` }, { status: 404 });
    portfolioId = pos.portfolioId;
  }

  const tx = await applyTransaction({
    portfolioId,
    symbol,
    type: "DIVIDEND",
    quantity: 1,
    price: data.amount,
    fees: 0,
    currency: data.currency,
    executedAt: data.date ?? new Date(),
    note: data.note,
  });
  return NextResponse.json(tx, { status: 201 });
}
