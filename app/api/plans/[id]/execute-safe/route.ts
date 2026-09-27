import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { executeSafeActions } from "@/lib/goals";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  try {
    return NextResponse.json(executeSafeActions(db, id, getMeta(db, "demo_now")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}
