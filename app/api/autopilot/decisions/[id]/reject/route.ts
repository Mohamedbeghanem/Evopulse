import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

export const POST = withWorkspace(async (ctx, _req, extra) => {
  const { id } = await (extra as { params: Promise<{ id: string }> }).params;
  try {
    return NextResponse.json(ExceptionAutopilotService.for(ctx.db).reject(id, getMeta(ctx.db, "demo_now")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ error: message }, { status: message === "Decision not found" ? 404 : 409 });
  }
});
