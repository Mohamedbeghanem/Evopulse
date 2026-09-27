import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { EarlyWarningEngine } from "@/lib/warnings";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { entityId?: string; now?: string };
  const db = getDb();
  const now = body.now || getMeta(db, "demo_now");
  const engine = EarlyWarningEngine.for(db);
  const rows = body.entityId ? engine.evaluateEntity(body.entityId, now) : engine.evaluateAll(now);
  return NextResponse.json({ warnings: rows.map((row) => engine.summarize(row)) });
}
