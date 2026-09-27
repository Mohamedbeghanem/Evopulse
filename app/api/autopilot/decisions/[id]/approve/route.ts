import { NextResponse } from "next/server";
import { withHumanActor } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

export const POST = withHumanActor("write", async (ctx, _body, _req, extra) => {
  const { id } = await (extra as { params: Promise<{ id: string }> }).params;
  try {
    return NextResponse.json(ExceptionAutopilotService.for(ctx.db).approve(id, getMeta(ctx.db, "demo_now"), ctx.actor));
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    const status = message === "Decision not found" || message === "Action not found" ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
});
