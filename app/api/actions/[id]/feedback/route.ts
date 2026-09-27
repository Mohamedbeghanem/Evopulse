import { NextResponse } from "next/server";
import { withHumanActor } from "@/lib/auth";
import { getDb, getMeta } from "@/lib/db";
import { HumanFeedbackService } from "@/lib/learning";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = HumanFeedbackService.for(getDb()).listForAction(id);
  const stats = HumanFeedbackService.for(getDb()).getCorrectionStats();
  return NextResponse.json({ feedback: rows, corrections: stats });
}

/** Human feedback on an action (accept / edit / reject the strategy). Signed-in writer or the public demo. */
export const POST = withHumanActor<{
  decision?: "ACCEPT" | "EDIT" | "REJECT";
  original_strategy?: string;
  final_strategy?: string;
  reason?: string;
}>("write", async (ctx, body, _req, extra) => {
  const { id } = await (extra as { params: Promise<{ id: string }> }).params;
  if (!body.decision) {
    return NextResponse.json({ error: "decision is required" }, { status: 400 });
  }
  try {
    const row = HumanFeedbackService.for(ctx.db).record({
      action_id: id,
      decision: body.decision,
      original_strategy: body.original_strategy,
      final_strategy: body.final_strategy,
      reason: body.reason,
      created_at: getMeta(ctx.db, "demo_now"),
    });
    return NextResponse.json({ feedback: row });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
});
