import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eventsFor } from "@/lib/events";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    from_id?: string;
    event_id?: string;
    entity_type?: string;
    entity_id?: string;
    entity?: { type?: string; id?: string };
  };
  const db = getDb();
  const service = eventsFor(db);
  try {
    if (body.event_id && !body.from_id && !body.entity_type && !body.entity_id && !body.entity) {
      return NextResponse.json(await service.replay(body.event_id));
    }
    const entityType = body.entity_type || body.entity?.type;
    const entityId = body.entity_id || body.entity?.id;
    return NextResponse.json(
      await service.replaySequence({
        from_id: body.from_id || body.event_id,
        entity_type: entityType,
        entity_id: entityId,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}
