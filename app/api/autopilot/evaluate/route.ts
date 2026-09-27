import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

export async function POST() {
  // The evaluation clock is server state, never request input: body.now let one POST with a future
  // date persist decisions and exception rows at a fabricated time. body.handleSafe additionally
  // let that same request auto-execute AUTO actions. Safe execution now only happens through its
  // own POST /api/autopilot/handle-safe, so evaluate is free of caller-chosen side effects.
  const db = getDb();
  const service = ExceptionAutopilotService.for(db);
  return NextResponse.json(service.evaluateSituation(getMeta(db, "demo_now")));
}
