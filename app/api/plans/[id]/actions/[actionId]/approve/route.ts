import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { approvePlanAction } from "@/lib/goals";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string; actionId: string }> }) {
  const { id, actionId } = await ctx.params;
  const db = getDb();
  try {
    return NextResponse.json({ action: approvePlanAction(db, id, actionId, getMeta(db, "demo_now")) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}
