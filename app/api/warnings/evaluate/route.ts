import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { EarlyWarningEngine } from "@/lib/warnings";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { entityId?: unknown };
  // The evaluation clock is server state, never request input. Accepting body.now let a single
  // POST with a future date persist expectation and warning changes and create exception rows,
  // permanently corrupting business state.
  const db = getDb();
  const now = getMeta(db, "demo_now");
  if (body.entityId !== undefined && (typeof body.entityId !== "string" || !body.entityId.trim())) {
    return NextResponse.json({ error: "entityId must be a non-empty string" }, { status: 400 });
  }
  const entityId = typeof body.entityId === "string" ? body.entityId.trim() : undefined;
  const engine = EarlyWarningEngine.for(db);
  const rows = entityId ? engine.evaluateEntity(entityId, now) : engine.evaluateAll(now);
  return NextResponse.json({ warnings: rows.map((row) => engine.summarize(row)) });
}
