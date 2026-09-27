import { NextResponse } from "next/server";
import { withHumanActor } from "@/lib/auth";
import { approvePromotion } from "@/lib/autonomy";
import { errorResponse } from "@/lib/autonomy/http";

/** Human-only autonomy change. The actor is the signed-in person (or the demo human), never the body. */
export const POST = withHumanActor<{ reason?: unknown; toLevel?: unknown }>("admin", async (ctx, body, _req, extra) => {
  const { actionType } = await (extra as { params: Promise<{ actionType: string }> }).params;
  try {
    const profile = approvePromotion(ctx.db, actionType, { toLevel: typeof body.toLevel === "number" ? body.toLevel : undefined, actor: ctx.actor, reason: typeof body.reason === "string" ? body.reason : undefined });
    return NextResponse.json({ profile });
  } catch (error) {
    return errorResponse(error);
  }
});
