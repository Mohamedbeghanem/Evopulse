import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { executeAction } from "@/lib/engine/execute";

/** Human execute after approval. executeAction rechecks policy and refuses unapproved APPROVAL_REQUIRED actions. */
export const POST = withWorkspace(async (ctx, _req, extra) => {
  const { id } = await (extra as { params: Promise<{ id: string }> }).params;
  try {
    return NextResponse.json(executeAction(ctx.db, id, getMeta(ctx.db, "demo_now")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
});
