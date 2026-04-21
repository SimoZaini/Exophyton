import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { applyTransaction, parseTransactionsCsv } from "@/lib/transactions";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owned = await prisma.portfolio.findFirst({ where: { id: params.id, userId: user.id } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const csv: string | undefined = body?.csv;
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "Missing 'csv' field" }, { status: 400 });
  }

  const { rows, errors } = parseTransactionsCsv(csv, params.id);

  let imported = 0;
  const failed: { line: number; reason: string }[] = [...errors];
  // Apply transactions in chronological order so BUY/SELL arithmetic is valid.
  const sorted = [...rows].sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());
  for (let i = 0; i < sorted.length; i++) {
    try {
      await applyTransaction(sorted[i]);
      imported++;
    } catch (e) {
      failed.push({ line: -1, reason: `${sorted[i].symbol}: ${(e as Error).message}` });
    }
  }
  return NextResponse.json({ imported, failed, total: rows.length + errors.length });
}
