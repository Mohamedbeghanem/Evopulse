import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hydratePlan } from "@/lib/goals";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ plan: hydratePlan(getDb(), id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 404 });
  }
}
