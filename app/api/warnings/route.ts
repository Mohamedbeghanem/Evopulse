import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import {
  buildGoalContext,
  businessTwin,
  comingNext,
  evaluateEarlyWarnings,
  groupActiveWarnings,
} from "@/lib/engine/warnings";

export async function GET(req: Request) {
  const db = getDb();
  const now = getMeta(db, "demo_now");
  const warnings = evaluateEarlyWarnings(db, now);
  const view = new URL(req.url).searchParams.get("view");
  return NextResponse.json({
    warnings,
    groups: groupActiveWarnings(warnings),
    twin: businessTwin(warnings),
    comingNext: comingNext(warnings),
    ...(view === "planner" ? { goalContext: buildGoalContext(db, now) } : {}),
  });
}
