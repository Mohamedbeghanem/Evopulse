import { NextResponse } from "next/server";
import { CommandRouter } from "@/lib/command";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { message?: string; question?: string; sessionId?: string };
  const message = (body.message || body.question || "").trim();
  const result = new CommandRouter(getDb()).route(message, body.sessionId);
  return NextResponse.json({
    ...result,
    question: message,
    answer: result.summary,
    grounded: result.intent !== "UNKNOWN",
  });
}
