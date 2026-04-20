import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const portfolios = await prisma.portfolio.findMany({
    where: { userId: user.id },
    include: { _count: { select: { positions: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(portfolios);
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  baseCurrency: z.string().length(3).default("USD"),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const portfolio = await prisma.portfolio.create({
    data: { ...parsed.data, userId: user.id },
  });
  return NextResponse.json(portfolio, { status: 201 });
}
