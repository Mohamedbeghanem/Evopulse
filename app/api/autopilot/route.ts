import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { autopilotSummary, runAutopilot } from "@/lib/autopilot";

/** Attention-first Pulse read model. Runs one idempotent autopilot pass first. */
export async function GET() {
  const db = getDb();
  return NextResponse.json(autopilotSummary(db, getMeta(db, "demo_now")));
}

/** Run one autopilot pass and return what changed (empty arrays on a repeat run). */
export async function POST() {
  const db = getDb();
  try {
    return NextResponse.json(runAutopilot(db, getMeta(db, "demo_now")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
