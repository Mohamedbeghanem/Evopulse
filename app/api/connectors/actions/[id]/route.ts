import { NextResponse } from "next/server";
import { approveConnectorAction, executeConnectorAction, rejectConnectorAction } from "@/lib/connectors/governance";
import { ActorClaimError, refuseAiActorClaim } from "@/lib/auth";
import { withConnectors } from "@/lib/connectors/http";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

/** A signed-in human approves (then policy is rechecked and the call runs) or rejects. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { decision?: string } & Record<string, unknown>;
  try {
    refuseAiActorClaim(body, Object.fromEntries(new URL(req.url).searchParams.entries()));
  } catch (error) {
    if (error instanceof ActorClaimError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  // The actor is the signed-in session user (withConnectors); a body actor is never read.
  return withConnectors("write", async ({ service, actor }) => {
    const now = service.now();
    if (body.decision === "reject") {
      return NextResponse.json({ action: toPlain(rejectConnectorAction(service.db, id, actor, now)) });
    }
    approveConnectorAction(service.db, id, actor, now);
    const action = await executeConnectorAction(service.db, service.workspaceId, id, now, actor);
    return NextResponse.json({ action: toPlain({ id: action.id, status: action.status, title: action.title }) });
  }, req);
}
