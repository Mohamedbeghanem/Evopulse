import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

export async function GET() {
  const db = getDb();
  const service = ExceptionAutopilotService.for(db);
  service.evaluateSituation(getMeta(db, "demo_now"));
  return NextResponse.json(service.summarize());
}
