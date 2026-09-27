import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { pulseSummary } from "@/lib/engine/pulse";

export async function GET() {
  const db = getDb();
  return NextResponse.json(pulseSummary(db, getMeta(db, "demo_now")));
}
