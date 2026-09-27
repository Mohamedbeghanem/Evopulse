import { NextResponse } from "next/server";
import { withHumanActor } from "@/lib/auth";
import { suspendAction } from "@/lib/autonomy";
import { errorResponse } from "@/lib/autonomy/http";

/** Human-only autonomy change. The actor is the signed-in person (or the demo human), never the body. */
export const POST = withHumanActor<{ reason?: unknown; toLevel?: unknown }>("write", async (ctx, body, _req, extra) => {
  const { actionType } = await (extra as { params: Promise<{ actionType: string }> }).params;
  try {
    const profile = suspendAction(ctx.db, actionType, { actor: ctx.actor, reason: typeof body.reason === "string" ? body.reason : undefined });
    return NextResponse.json({ profile });
  } catch (error) {
    return errorResponse(error);
  }
});
