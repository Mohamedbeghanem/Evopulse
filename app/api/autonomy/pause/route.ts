import { NextResponse } from "next/server";
import { withHumanActor } from "@/lib/auth";
import { emergencyPause } from "@/lib/autonomy";
import { errorResponse } from "@/lib/autonomy/http";

export const POST = withHumanActor<{ reason?: unknown }>("write", async (ctx, body) => {
  try {
    return NextResponse.json({ pause: emergencyPause(ctx.db, { actor: ctx.actor, reason: typeof body.reason === "string" ? body.reason : undefined }) });
  } catch (error) {
    return errorResponse(error);
  }
});
