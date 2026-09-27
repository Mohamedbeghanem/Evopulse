import { NextResponse } from "next/server";
import { withHumanActor } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

export const POST = withHumanActor("write", async (ctx, _body, _req, extra) => {
  const { id } = await (extra as { params: Promise<{ id: string }> }).params;
  return NextResponse.json(ExceptionAutopilotService.for(ctx.db).takeOver(id, getMeta(ctx.db, "demo_now"), ctx.actor));
});
