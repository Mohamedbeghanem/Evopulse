import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { createGoal, listGoalSummaries } from "@/lib/goals";

export const GET = withWorkspace(async (ctx) => {
  return NextResponse.json({ goals: listGoalSummaries(ctx.db) });
});

export const POST = withWorkspace(async (ctx, req) => {
  const body = (await req.json().catch(() => ({}))) as {
    utterance?: string;
    goalType?: string;
    scope?: string;
    deadline?: string;
    constraints?: Record<string, unknown>;
    plan?: boolean;
  };
  const now = getMeta(ctx.db, "demo_now");
  try {
    const result = createGoal(
      ctx.db,
      {
        utterance: body.utterance,
        goalType: body.goalType,
        scope: body.scope,
        deadline: body.deadline,
        constraints: body.constraints,
        source: "api",
      },
      now,
      { plan: body.plan !== false },
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
});
