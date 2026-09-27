import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { businessTwin } from "@/lib/engine/twin";
import { pulseSummary } from "@/lib/engine/pulse";

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    now: getMeta(db, "demo_now"),
    phase: getMeta(db, "demo_phase"),
    supplierPhase: getMeta(db, "supplier_phase", "stable"),
    twin: businessTwin(db),
    pulse: pulseSummary(db, getMeta(db, "demo_now")),
  });
}
