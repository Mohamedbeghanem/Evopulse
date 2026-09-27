import { NextResponse } from "next/server";
import { getAgentRuntime } from "@/lib/agent";
import { toAskResponse } from "@/lib/agent/present";
import { getDb } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runtime = getAgentRuntime(getDb());
  const run = runtime.cancel(id);
  return NextResponse.json(toAskResponse(run, run.command));
}
