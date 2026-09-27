import { NextResponse } from "next/server";
import { getAgentRuntime } from "@/lib/agent";
import { toAskResponse } from "@/lib/agent/present";
import { getDb } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { approvalId?: string; actionId?: string; actor?: string };
  const runtime = getAgentRuntime(getDb());
  const run = await runtime.resumeAfterApproval(id, {
    approvalId: body.approvalId,
    actionId: body.actionId,
    decision: "reject",
    actor: body.actor || "operator",
  });
  return NextResponse.json(toAskResponse(run, run.command));
}
