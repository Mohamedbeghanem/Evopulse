import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { ingestMessage } from "@/lib/engine/ingest";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: string; occurredAt?: string };
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const db = getDb();
  const result = await ingestMessage(db, body.text.trim(), {
    occurredAt: body.occurredAt || getMeta(db, "demo_now"),
    source: "api",
  });
  return NextResponse.json(result);
}
