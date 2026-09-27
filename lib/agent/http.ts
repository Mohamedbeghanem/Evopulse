import { NextResponse } from "next/server";
import { AgentError } from "./errors";

/**
 * Shared error mapping for the /api/agent routes.
 *
 * Anything that is not an AgentError is a fault we did not anticipate, so it is a 500 — the
 * previous default of 400 blamed the caller for our own bugs.
 */
export function errorResponse(error: unknown) {
  if (error instanceof AgentError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "failed" },
    { status: 500 },
  );
}

/** The decision fields both the approve and reject routes accept. */
export async function readDecisionBody(req: Request): Promise<{
  approvalId?: string;
  actionId?: string;
  decision?: "approve" | "reject" | "edit";
  actor?: string;
}> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const decision = body.decision;
  return {
    approvalId: typeof body.approvalId === "string" ? body.approvalId : undefined,
    actionId: typeof body.actionId === "string" ? body.actionId : undefined,
    decision:
      decision === "approve" || decision === "reject" || decision === "edit" ? decision : undefined,
    actor: typeof body.actor === "string" ? body.actor : undefined,
  };
}
