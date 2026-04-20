import { NextResponse } from "next/server";
import { searchSymbols } from "@/lib/market";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q) return NextResponse.json([]);
  const results = await searchSymbols(q);
  return NextResponse.json(results);
}
