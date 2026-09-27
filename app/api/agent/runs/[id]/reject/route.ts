import { NextResponse } from "next/server";
import { getAgentRuntime } from "@/lib/agent";
import { toAskResponse } from "@/lib/agent/present";
import { withWorkspace } from "@/lib/auth";

export const POST = withWorkspace(async (ctx, req, extra) => {
  const { id } = await ((extra as { params: Promise<{ id: string }> } | undefined)?.params ?? Promise.resolve({ id: "" }));
  const body = (await req.json().catch(() => ({}))) as { approvalId?: string; actionId?: string; actor?: string };
  const runtime = getAgentRuntime(ctx.db);
  try {
    const run = await runtime.resumeAfterApproval(id, {
      approvalId: body.approvalId,
      actionId: body.actionId,
      decision: "reject",
      actor: body.actor || ctx.user?.name || "operator",
    });
    return NextResponse.json(toAskResponse(run, run.command));
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    const status = /not found/i.test(message) ? 404 : /no longer pending/.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});
