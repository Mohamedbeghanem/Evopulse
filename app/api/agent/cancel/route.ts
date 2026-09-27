import { NextResponse } from "next/server";
import { cancelAgentRun } from "@/lib/agent";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { runId?: string };
  if (!body.runId) {
    return NextResponse.json({ error: "runId is required" }, { status: 400 });
  }
  return NextResponse.json({ cancelled: cancelAgentRun(body.runId), state: "CANCELLED" });
}
