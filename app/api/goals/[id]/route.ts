import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getGoalBundle } from "@/lib/goals";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const bundle = getGoalBundle(getDb(), id);
  if (!bundle) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  return NextResponse.json(bundle);
}
