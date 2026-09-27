import { NextResponse } from "next/server";
import { getAgentRuntime } from "@/lib/agent";
import { toAskResponse } from "@/lib/agent/present";
import { withHumanActor } from "@/lib/auth";

/** Human-only decision on an agent run approval. The actor is the signed-in person (or the demo human), never the body. */
export const POST = withHumanActor<{ approvalId?: string; actionId?: string; decision?: "approve" | "reject" | "edit" }>(
  "write",
  async (ctx, body, req, context) => {
    const params = (context as { params: Promise<{ id: string }> } | undefined)?.params;
    const { id } = params ? await params : { id: "" };
    const runId = id || new URL(req.url).pathname.split("/").at(-2) || "";
    const decision = body.decision === "reject" || body.decision === "edit" ? body.decision : "approve";
    try {
      const run = await getAgentRuntime(ctx.db).resumeAfterApproval(runId, {
        approvalId: body.approvalId,
        actionId: body.actionId,
        decision,
        actor: ctx.actor,
      });
      return NextResponse.json(toAskResponse(run, run.command));
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed";
      const status = /not found/i.test(message) ? 404 : /no longer pending/.test(message) ? 409 : /AI cannot approve/.test(message) ? 403 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  },
);
