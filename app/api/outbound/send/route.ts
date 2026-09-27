import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { approveAndSendDraft, OutboundError } from "@/lib/outbound";

/** Human approval of a single draft. The default provider records locally; nothing is sent externally. */
export const POST = withWorkspace(async (ctx, req) => {
  const body = (await req.json().catch(() => ({}))) as { draftId?: unknown; actor?: unknown };
  if (typeof body.draftId !== "string" || !body.draftId) {
    return NextResponse.json({ error: "draftId is required" }, { status: 400 });
  }
  try {
    const actor = ctx.user?.name || body.actor || "operator";
    const result = await approveAndSendDraft(ctx.db, body.draftId, actor, { workspaceId: ctx.workspace?.id });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const status = error instanceof OutboundError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status });
  }
});
