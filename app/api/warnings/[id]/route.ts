import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { evaluateEarlyWarnings, getWarningView, simulationAvailable } from "@/lib/engine/warnings";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  evaluateEarlyWarnings(db, getMeta(db, "demo_now"));
  const warning = getWarningView(db, id);
  if (!warning) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ...warning, simulationAvailable: simulationAvailable() });
}
