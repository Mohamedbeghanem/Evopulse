import { NextResponse } from "next/server";
import { getAgentRuntime } from "@/lib/agent";
import { toAskResponse } from "@/lib/agent/present";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { command?: string; message?: string; sessionId?: string };
  const command = (body.command || body.message || "").trim();
  if (!command) return NextResponse.json({ error: "command is required" }, { status: 400 });
  const runtime = getAgentRuntime(getDb());
  const run = await runtime.run({ command, sessionId: body.sessionId });
  return NextResponse.json(toAskResponse(run, command));
}
