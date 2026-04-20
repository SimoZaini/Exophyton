import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getPortfolioHistory } from "@/lib/portfolio";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owned = await prisma.portfolio.findFirst({ where: { id: params.id, userId: user.id } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const period = (new URL(req.url).searchParams.get("period") ?? "1y") as
    | "1mo"
    | "3mo"
    | "6mo"
    | "1y"
    | "2y"
    | "5y";
  const hist = await getPortfolioHistory(params.id, period);
  return NextResponse.json(hist);
}
