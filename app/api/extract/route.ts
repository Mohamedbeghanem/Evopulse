import { NextResponse } from "next/server";
import { DEMO_NOW_ISO, MESSAGE_ONE_ISO } from "@/lib/clock";
import { extractCommitments } from "@/lib/engine/extract";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: string; occurredAt?: string; now?: string };
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const result = await extractCommitments(body.text.trim(), body.occurredAt || MESSAGE_ONE_ISO, body.now || DEMO_NOW_ISO);
  return NextResponse.json(result);
}
