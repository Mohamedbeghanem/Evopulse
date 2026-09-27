import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    ok: true,
    now: getMeta(db, "demo_now"),
    phase: getMeta(db, "demo_phase"),
    supplier_phase: getMeta(db, "supplier_phase", "stable"),
    brev: "not used",
  });
}
