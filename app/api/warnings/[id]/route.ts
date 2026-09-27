import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { EarlyWarningEngine, WarningExplanationService } from "@/lib/warnings";
import { getMeta } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const row = EarlyWarningEngine.for(db).get(id);
  if (!row) return NextResponse.json({ error: "Warning not found" }, { status: 404 });
  const explanation = WarningExplanationService.for(db).explain(id, getMeta(db, "demo_now"));
  return NextResponse.json({ warning: EarlyWarningEngine.for(db).summarize(row), explanation });
}
