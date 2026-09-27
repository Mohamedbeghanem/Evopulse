import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { buildRecoveryPlan } from "@/lib/engine/recovery";
import { getPlanBundle } from "@/lib/engine/recovery";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  try {
    buildRecoveryPlan(db, id, getMeta(db, "demo_now"));
    return NextResponse.json(getPlanBundle(db, id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}
