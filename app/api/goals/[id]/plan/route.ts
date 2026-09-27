import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { buildPlan, refreshGoalStatus } from "@/lib/goals";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const now = getMeta(db, "demo_now");
  try {
    const plan = buildPlan(db, id, now);
    refreshGoalStatus(db, id, now);
    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}
