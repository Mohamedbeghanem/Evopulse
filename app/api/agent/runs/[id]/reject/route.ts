import { NextResponse } from "next/server";
import { getAgentRuntime } from "@/lib/agent";
import { toAskResponse } from "@/lib/agent/present";
import { withHumanActor } from "@/lib/auth";

export const POST = withHumanActor<{ approvalId?: string; actionId?: string }>("write", async (ctx, body, _req, extra) => {
  const { id } = await ((extra as { params: Promise<{ id: string }> } | undefined)?.params ?? Promise.resolve({ id: "" }));
  try {
    const run = await getAgentRuntime(ctx.db).resumeAfterApproval(id, {
      approvalId: body.approvalId,
      actionId: body.actionId,
      decision: "reject",
      actor: ctx.actor,
    });
    return NextResponse.json(toAskResponse(run, run.command));
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    const status = /not found/i.test(message) ? 404 : /no longer pending/.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});
