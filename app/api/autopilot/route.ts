import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

export async function GET(req: Request) {
  const db = getDb();
  const now = getMeta(db, "demo_now");
  const q = new URL(req.url).searchParams.get("q");
  const service = ExceptionAutopilotService.for(db);
  if (q) return NextResponse.json(service.commandAnswer(q, now));
  return NextResponse.json(service.evaluateSituation(now));
}
