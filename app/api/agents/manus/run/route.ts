import { NextResponse } from "next/server";
import { loadManusRun, runManusGoal } from "@/lib/agents/manus";
import { withWorkspace } from "@/lib/auth";

/**
 * Start a Manus (OpenManus-native) run on the current workspace. Read tools run; anything
 * consequential becomes an approval item decided through POST /api/agent/runs/:id/approve.
 * `answer` + `previousRunId` continue a run that stopped on ask_human (the answer is user input).
 */
export const POST = withWorkspace(async (ctx, req) => {
  const body = (await req.json().catch(() => ({}))) as { goal?: string; answer?: string; previousRunId?: string; sessionId?: string };
  let goal = String(body.goal || "").trim();
  if (body.previousRunId && body.answer) {
    try {
      const previous = loadManusRun(ctx.db, String(body.previousRunId));
      goal = `${previous.goal}\n\nAnswer to "${previous.question || "your question"}": ${String(body.answer).trim().slice(0, 1_000)}`;
    } catch {
      return NextResponse.json({ error: "Previous run not found" }, { status: 404 });
    }
  }
  if (!goal) return NextResponse.json({ error: "goal is required" }, { status: 400 });
  if (goal.length > 2_000) return NextResponse.json({ error: "goal is too long" }, { status: 400 });
  const run = await runManusGoal(ctx.db, { goal, sessionId: body.sessionId });
  return NextResponse.json({ run });
});
