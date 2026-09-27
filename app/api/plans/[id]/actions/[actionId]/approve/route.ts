import { NextResponse } from "next/server";
import { withHumanActor } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { approvePlanAction } from "@/lib/goals";

/** Human-only action approval (desktop plan page + /m). Policy is rechecked inside approvePlanAction. */
export const POST = withHumanActor("write", async (ctx, _body, _req, extra) => {
  const { id, actionId } = await (extra as { params: Promise<{ id: string; actionId: string }> }).params;
  try {
    return NextResponse.json({ action: approvePlanAction(ctx.db, id, actionId, getMeta(ctx.db, "demo_now"), ctx.actor) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
});
