import { NextResponse } from "next/server";
import { withHumanActor } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { approvePlan, executePlan } from "@/lib/engine/execute";

/** Human-only plan approval (optionally executing the approved plan; policy rechecked per action). */
export const POST = withHumanActor<{ execute?: boolean }>("write", async (ctx, body, _req, extra) => {
  const { id } = await (extra as { params: Promise<{ id: string }> }).params;
  const now = getMeta(ctx.db, "demo_now");
  try {
    if (body.execute !== false) return NextResponse.json(executePlan(ctx.db, id, now, ctx.actor));
    return NextResponse.json({ plan: approvePlan(ctx.db, id, now, ctx.actor) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
});
