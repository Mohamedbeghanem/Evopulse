import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const service = ExceptionAutopilotService.for(getDb());
  const row = service.get(id);
  if (!row) return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  return NextResponse.json({ decision: row, explanation: service.explain(id) });
}
