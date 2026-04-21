import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { applyTransaction } from "@/lib/transactions";

const createSchema = z.object({
  symbol: z.string().min(1).max(20),
  type: z.enum(["BUY", "SELL", "DIVIDEND", "FEE"]),
  quantity: z.coerce.number().min(0),
  price: z.coerce.number().min(0).default(0),
  fees: z.coerce.number().min(0).default(0),
  currency: z.string().length(3).default("USD"),
  executedAt: z.coerce.date().optional(),
  note: z.string().max(500).optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owned = await prisma.portfolio.findFirst({ where: { id: params.id, userId: user.id } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const txs = await prisma.transaction.findMany({
    where: { portfolioId: params.id },
    orderBy: { executedAt: "desc" },
    take: 500,
  });
  return NextResponse.json(txs);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owned = await prisma.portfolio.findFirst({ where: { id: params.id, userId: user.id } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const tx = await applyTransaction({
      portfolioId: params.id,
      symbol: data.symbol.toUpperCase(),
      type: data.type,
      quantity: data.quantity,
      price: data.price,
      fees: data.fees,
      currency: data.currency,
      executedAt: data.executedAt ?? new Date(),
      note: data.note,
    });
    return NextResponse.json(tx, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
