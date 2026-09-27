import { NextResponse } from "next/server";
import { withHumanActor } from "@/lib/auth";
import { approveAndSendDraft, OutboundError } from "@/lib/outbound";

/** Human approval of a single draft. The default provider records locally; nothing is sent externally. */
export const POST = withHumanActor<{ draftId?: unknown }>("write", async (ctx, body) => {
  if (typeof body.draftId !== "string" || !body.draftId) {
    return NextResponse.json({ error: "draftId is required" }, { status: 400 });
  }
  try {
    const result = await approveAndSendDraft(ctx.db, body.draftId, ctx.actor, { workspaceId: ctx.workspace?.id });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const status = error instanceof OutboundError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status });
  }
});
