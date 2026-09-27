import { NextResponse } from "next/server";
import { SHIP_EXPECTED_ISO } from "@/lib/clock";
import { getDb, getMeta } from "@/lib/db";
import { EarlyWarningEngine } from "@/lib/warnings";

export async function POST() {
  const db = getDb();
  const rows = EarlyWarningEngine.for(db).reviseShipmentArrival(SHIP_EXPECTED_ISO, getMeta(db, "demo_now"));
  return NextResponse.json({
    ok: true,
    arrival: SHIP_EXPECTED_ISO,
    warnings: rows.map((row) => EarlyWarningEngine.for(db).summarize(row)),
  });
}
