import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { now?: string; handleSafe?: boolean };
  const db = getDb();
  const now = body.now || getMeta(db, "demo_now");
  const service = ExceptionAutopilotService.for(db);
  return NextResponse.json(service.evaluateSituation(now, { handleSafe: body.handleSafe }));
}
