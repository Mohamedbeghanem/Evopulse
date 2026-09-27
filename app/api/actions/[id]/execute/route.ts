import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { executeAction } from "@/lib/engine/execute";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  try {
    return NextResponse.json(executeAction(db, id, getMeta(db, "demo_now")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}
