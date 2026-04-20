import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getQuote } from "@/lib/market";
import { refreshProfile } from "@/lib/fundamentals";

const schema = z.object({
  symbol: z.string().min(1).max(20),
  quantity: z.coerce.number().positive(),
  avgCost: z.coerce.number().positive(),
  assetType: z.enum(["EQUITY", "ETF", "CRYPTO", "CASH"]).default("EQUITY"),
  sector: z.string().optional(),
  currency: z.string().length(3).default("USD"),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owned = await prisma.portfolio.findFirst({ where: { id: params.id, userId: user.id } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  const data = parsed.data;
  const symbol = data.symbol.toUpperCase();

  // Probe the symbol; allow creation even if quote fails (currency override ok).
  const quote = await getQuote(symbol);

  const existing = await prisma.position.findUnique({
    where: { portfolioId_symbol: { portfolioId: params.id, symbol } },
  });

  let position;
  if (existing) {
    const newQty = existing.quantity + data.quantity;
    const newAvg = (existing.avgCost * existing.quantity + data.avgCost * data.quantity) / newQty;
    position = await prisma.position.update({
      where: { id: existing.id },
      data: { quantity: newQty, avgCost: newAvg },
    });
  } else {
    position = await prisma.position.create({
      data: {
        portfolioId: params.id,
        symbol,
        quantity: data.quantity,
        avgCost: data.avgCost,
        assetType: data.assetType,
        sector: data.sector ?? null,
        currency: quote?.currency ?? data.currency,
      },
    });
  }

  await prisma.transaction.create({
    data: {
      portfolioId: params.id,
      symbol,
      type: "BUY",
      quantity: data.quantity,
      price: data.avgCost,
      currency: quote?.currency ?? data.currency,
      executedAt: new Date(),
    },
  });

  // Fire-and-forget: fetch & cache company profile so dividend/sector/country
  // metadata is available on first render.
  refreshProfile(symbol).catch(() => null);

  return NextResponse.json(position, { status: 201 });
}
