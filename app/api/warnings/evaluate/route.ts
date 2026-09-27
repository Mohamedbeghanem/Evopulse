import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { businessTwin, evaluateEarlyWarnings } from "@/lib/engine/warnings";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { now?: unknown; entityId?: unknown };
  const db = getDb();
  const now = typeof body.now === "string" ? body.now : getMeta(db, "demo_now");
  const warnings = evaluateEarlyWarnings(db, now, typeof body.entityId === "string" ? { startId: body.entityId } : undefined);
  return NextResponse.json({ warnings, twin: businessTwin(warnings) });
}
