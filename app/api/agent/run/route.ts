import { NextResponse } from "next/server";
import { getAgentRuntime } from "@/lib/agent";
import { toAskResponse } from "@/lib/agent/present";
import { withWorkspace } from "@/lib/auth";

export const POST = withWorkspace(async (ctx, req) => {
  const body = (await req.json().catch(() => ({}))) as { command?: string; message?: string; sessionId?: string };
  const command = (body.command || body.message || "").trim();
  if (!command) return NextResponse.json({ error: "command is required" }, { status: 400 });
  const runtime = getAgentRuntime(ctx.db);
  const run = await runtime.run({ command, sessionId: body.sessionId });
  return NextResponse.json(toAskResponse(run, command));
});
