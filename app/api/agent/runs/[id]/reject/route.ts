import { NextResponse } from "next/server";
import { getAgentRuntime } from "@/lib/agent";
import { errorResponse, readDecisionBody } from "@/lib/agent/http";
import { toAskResponse } from "@/lib/agent/present";
import { getDb } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readDecisionBody(req);
  const runtime = getAgentRuntime(getDb());
  try {
    const run = await runtime.resumeAfterApproval(id, {
      approvalId: body.approvalId,
      actionId: body.actionId,
      decision: "reject",
      actor: body.actor || "operator",
    });
    return NextResponse.json(toAskResponse(run, run.command));
  } catch (error) {
    return errorResponse(error);
  }
}
