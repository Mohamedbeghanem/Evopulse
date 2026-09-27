import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { WarningExplanationService } from "@/lib/warnings";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const explanation = WarningExplanationService.for(getDb()).explain(id, getMeta(getDb(), "demo_now"));
  if (!explanation) return NextResponse.json({ error: "Warning not found" }, { status: 404 });
  return NextResponse.json(explanation);
}
