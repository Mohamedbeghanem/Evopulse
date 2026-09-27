import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { DuplicateEventError, eventsFor } from "@/lib/events";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const db = getDb();
  const events = eventsFor(db).list({
    type: url.searchParams.get("type") || undefined,
    entity_type: url.searchParams.get("entity_type") || undefined,
    entity_id: url.searchParams.get("entity_id") || undefined,
    source: url.searchParams.get("source") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });
  return NextResponse.json({ events, count: events.length });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.type !== "string" || typeof body.source !== "string") {
    return NextResponse.json({ error: "type and source are required" }, { status: 400 });
  }
  try {
    const event = eventsFor(getDb()).append({
      id: typeof body.id === "string" ? body.id : undefined,
      type: body.type,
      source: body.source,
      source_id: optionalString(body.source_id),
      actor_id: optionalString(body.actor_id),
      entity_type: optionalString(body.entity_type),
      entity_id: optionalString(body.entity_id),
      payload: isRecord(body.payload) ? body.payload : undefined,
      occurred_at: typeof body.occurred_at === "string" ? body.occurred_at : undefined,
      received_at: typeof body.received_at === "string" ? body.received_at : undefined,
      confidence: typeof body.confidence === "number" ? body.confidence : undefined,
      metadata: isRecord(body.metadata) ? body.metadata : undefined,
      idempotent: body.idempotent === true,
    });
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    const status = error instanceof DuplicateEventError ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
