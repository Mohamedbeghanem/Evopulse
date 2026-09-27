import { NextResponse } from "next/server";
import { getAgentRuntime } from "@/lib/agent";
import { toAskResponse } from "@/lib/agent/present";
import { withWorkspace } from "@/lib/auth";

export const POST = withWorkspace(async (ctx, req, context) => {
  const params = (context as { params: Promise<{ id: string }> } | undefined)?.params;
  const { id } = params ? await params : { id: "" };
  const url = new URL(req.url);
  const runId = id || url.pathname.split("/").at(-2) || "";
  const body = (await req.json().catch(() => ({}))) as {
    approvalId?: string;
    actionId?: string;
    decision?: "approve" | "reject" | "edit";
    actor?: string;
  };
  const runtime = getAgentRuntime(ctx.db);
  try {
    const run = await runtime.resumeAfterApproval(runId, {
      approvalId: body.approvalId,
      actionId: body.actionId,
      decision: body.decision || "approve",
      actor: body.actor || ctx.user?.name || "operator",
    });
    return NextResponse.json(toAskResponse(run, run.command));
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    const status = /not found/i.test(message) ? 404 : /no longer pending/.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});
