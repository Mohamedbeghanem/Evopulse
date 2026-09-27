import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { executeAction } from "@/lib/engine/execute";
import { isConnectorAction } from "@/lib/connectors/governance";

/** Human execute after approval. executeAction rechecks policy and refuses unapproved APPROVAL_REQUIRED actions. */
export const POST = withWorkspace(async (ctx, _req, extra) => {
  const { id } = await (extra as { params: Promise<{ id: string }> }).params;
  const action = ctx.db.prepare("SELECT type FROM actions WHERE id = ?").get(id) as { type: string } | undefined;
  if (action && isConnectorAction(action)) {
    return NextResponse.json({ error: "Connector actions execute through /api/connectors/actions." }, { status: 409 });
  }
  try {
    return NextResponse.json(executeAction(ctx.db, id, getMeta(ctx.db, "demo_now")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
});
