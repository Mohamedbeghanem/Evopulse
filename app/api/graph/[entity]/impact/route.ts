import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { calculateGraphImpact } from "@/lib/engine/impact";

export async function GET(_req: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  return NextResponse.json(calculateGraphImpact(getDb(), entity));
}
