import { NextResponse } from "next/server";
import { getAgentRuntime } from "@/lib/agent";
import { toAskResponse } from "@/lib/agent/present";
import { getDb } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const runtime = getAgentRuntime(getDb());
    const run = runtime.getStatus(id);
    return NextResponse.json(toAskResponse(run, run.command));
  } catch {
    return NextResponse.json({ error: "Agent run not found" }, { status: 404 });
  }
}
