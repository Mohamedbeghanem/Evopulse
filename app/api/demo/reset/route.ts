import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { wipeAndSeed } from "@/lib/seed";

export async function POST() {
  const db = getDb();
  wipeAndSeed(db);
  return NextResponse.json({
    ok: true,
    phase: getMeta(db, "demo_phase", "seeded"),
    supplier_phase: getMeta(db, "supplier_phase", "stable"),
  });
}
