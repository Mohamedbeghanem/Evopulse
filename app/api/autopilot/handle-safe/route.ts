import { NextResponse } from "next/server";
import { withHumanActor } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

/** A person asks Autopilot to handle the policy-AUTO actions. Requires a signed-in writer (or the public demo). */
export const POST = withHumanActor("write", async (ctx) => {
  try {
    return NextResponse.json(ExceptionAutopilotService.for(ctx.db).handleSafe(getMeta(ctx.db, "demo_now")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
});
