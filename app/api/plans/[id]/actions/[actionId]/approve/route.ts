import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { approvePlanAction } from "@/lib/goals";

/** Human-only action approval (desktop plan page + /m). Policy is rechecked inside approvePlanAction. */
export const POST = withWorkspace(async (ctx, _req, extra) => {
  const { id, actionId } = await (extra as { params: Promise<{ id: string; actionId: string }> }).params;
  try {
    return NextResponse.json({ action: approvePlanAction(ctx.db, id, actionId, getMeta(ctx.db, "demo_now")) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
});
