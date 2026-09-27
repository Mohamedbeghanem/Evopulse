import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { evaluateEarlyWarnings, getWarningView } from "@/lib/engine/warnings";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  evaluateEarlyWarnings(db, getMeta(db, "demo_now"));
  const warning = getWarningView(db, id);
  if (!warning) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: warning.id,
    summary: warning.summary,
    failed: warning.failed,
    failedAnswer: warning.failedAnswer,
    why: warning.explanation,
    source: warning.source,
    time: {
      availableHours: warning.availableHours,
      requiredHours: warning.requiredHours,
      shortfallHours: warning.shortfallHours,
      bufferHours: warning.bufferHours,
    },
    evidence: warning.evidence,
    exceptionId: warning.exceptionId,
    learning: warning.learning,
  });
}
