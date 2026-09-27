import { NextResponse } from "next/server";
import { loadLatestRun } from "@/lib/agent";
import { avatarLabel, avatarStateFromAgent } from "@/lib/company";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const run = loadLatestRun(getDb());
  const state = avatarStateFromAgent(run?.phase, run?.status);
  return NextResponse.json({
    state,
    label: avatarLabel(state),
    phase: run?.phase ?? "IDLE",
    status: run?.status ?? "idle",
    runId: run?.id ?? null,
    command: run?.command ?? null,
    summary: run?.summary ?? "",
  });
}
