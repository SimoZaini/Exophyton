import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getEnrichedPortfolio } from "@/lib/portfolio";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owned = await prisma.portfolio.findFirst({ where: { id: params.id, userId: user.id } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const summary = await getEnrichedPortfolio(params.id);
  return NextResponse.json(summary);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owned = await prisma.portfolio.findFirst({ where: { id: params.id, userId: user.id } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.portfolio.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
