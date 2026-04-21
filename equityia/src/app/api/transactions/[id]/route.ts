import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { revertTransaction } from "@/lib/transactions";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tx = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: { portfolio: true },
  });
  if (!tx || tx.portfolio.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await revertTransaction(tx);
  return NextResponse.json({ ok: true });
}
