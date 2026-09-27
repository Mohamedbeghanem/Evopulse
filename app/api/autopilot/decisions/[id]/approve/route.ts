import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  try {
    return NextResponse.json(ExceptionAutopilotService.for(db).approve(id, getMeta(db, "demo_now")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    const status = message === "Decision not found" || message === "Action not found" ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
