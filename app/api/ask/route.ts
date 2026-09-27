import { NextResponse } from "next/server";
import { CommandRouter } from "@/lib/command";
import { getAgentRuntime } from "@/lib/agent";
import { toAskResponse } from "@/lib/agent/present";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    question?: string;
    sessionId?: string;
  };
  const message = (body.message || body.question || "").trim();
  try {
    const runtime = getAgentRuntime(getDb());
    const run = await runtime.run({ command: message, sessionId: body.sessionId });
    return NextResponse.json(toAskResponse(run, message));
  } catch {
    const result = new CommandRouter(getDb()).route(message, body.sessionId);
    return NextResponse.json({
      ...result,
      question: message,
      answer: result.summary,
      grounded: result.intent !== "UNKNOWN",
      fallback: true,
    });
  }
}
