import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pos = await prisma.position.findUnique({
    where: { id: params.id },
    include: { portfolio: true },
  });
  if (!pos || pos.portfolio.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.position.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
