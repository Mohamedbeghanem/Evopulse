import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { approvePlan, executePlan } from "@/lib/engine/execute";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { execute?: boolean };
  const db = getDb();
  const now = getMeta(db, "demo_now");
  try {
    if (body.execute !== false) {
      return NextResponse.json(executePlan(db, id, now));
    }
    return NextResponse.json({ plan: approvePlan(db, id, now) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}
