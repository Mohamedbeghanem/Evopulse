import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { createGoal, listGoalSummaries } from "@/lib/goals";

export async function GET() {
  const db = getDb();
  return NextResponse.json({ goals: listGoalSummaries(db) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    utterance?: string;
    goalType?: string;
    scope?: string;
    deadline?: string;
    constraints?: Record<string, unknown>;
    plan?: boolean;
  };
  const db = getDb();
  const now = getMeta(db, "demo_now");
  try {
    const result = createGoal(
      db,
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
}
