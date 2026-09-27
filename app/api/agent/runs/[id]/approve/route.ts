import { NextResponse } from "next/server";
import { getAgentRuntime } from "@/lib/agent";
import { toAskResponse } from "@/lib/agent/present";
import { getDb } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    approvalId?: string;
    actionId?: string;
    decision?: "approve" | "reject" | "edit";
    actor?: string;
  };
  const runtime = getAgentRuntime(getDb());
  try {
    const run = await runtime.resumeAfterApproval(id, {
      approvalId: body.approvalId,
      actionId: body.actionId,
      decision: body.decision || "approve",
      actor: body.actor || "operator",
    });
    return NextResponse.json(toAskResponse(run, run.command));
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    const status = /not found/i.test(message) ? 404 : /no longer pending/.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
