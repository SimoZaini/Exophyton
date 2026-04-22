import { NextResponse } from "next/server";
import { seedDemo } from "@/lib/seed";

// One-shot seed endpoint for fresh production databases.
// Protected by SEED_TOKEN env var — call with `Authorization: Bearer <token>`.
// Idempotent: upserts the demo user / portfolio / positions, rewrites
// transaction history to match the canonical demo set.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  const token = process.env.SEED_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "SEED_TOKEN not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${token}`) return unauthorized();

  try {
    const report = await seedDemo();
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
