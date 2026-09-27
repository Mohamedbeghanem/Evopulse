import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

export async function POST() {
  const db = getDb();
  return NextResponse.json(ExceptionAutopilotService.for(db).handleSafe(getMeta(db, "demo_now")));
}
