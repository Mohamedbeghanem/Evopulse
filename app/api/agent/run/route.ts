import { NextResponse } from "next/server";
import { createAIProvider, runAgent } from "@/lib/agent";
import { getRequestedAgentProvider } from "@/lib/agent/config";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { command?: string; question?: string };
  const command = (body.command || body.question || "").trim();
  if (!command) {
    return NextResponse.json({ error: "command is required" }, { status: 400 });
  }

  const requested = getRequestedAgentProvider();
  const provider = requested === "openrouter" ? createAIProvider("openrouter") : null;

  try {
    const result = await runAgent(getDb(), command, {
      provider,
      forceProvider: requested,
      signal: req.signal,
    });
    return NextResponse.json(result);
  } catch (error) {
    const fallback = await runAgent(getDb(), command, { forceProvider: "deterministic" });
    return NextResponse.json({
      ...fallback,
      fallbackUsed: true,
      fallbackReason: error instanceof Error ? error.message : "Agent route failed.",
    });
  }
}
