import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { all, one, run } from "../db";
import type { EventRow } from "../types";
import type { BusinessEvent, EventListFilters } from "./types";

export class EventRepository {
  constructor(private readonly db: DatabaseSync) {}

  persist(event: BusinessEvent) {
    const cols = columnNames(this.db);
    const payload = JSON.stringify(event.payload ?? {});
    const metadata = JSON.stringify(event.metadata ?? {});
    if (cols.has("source_id")) {
      run(
        this.db,
        `INSERT INTO events
          (id, type, source, source_id, actor_id, entity_type, entity_id, payload, occurred_at, received_at, confidence, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           type = excluded.type,
           source = excluded.source,
           source_id = excluded.source_id,
           actor_id = excluded.actor_id,
           entity_type = excluded.entity_type,
           entity_id = excluded.entity_id,
           payload = excluded.payload,
           occurred_at = excluded.occurred_at,
           received_at = excluded.received_at,
           confidence = excluded.confidence,
           metadata = excluded.metadata`,
        [
          event.id,
          event.type,
          event.source,
          event.source_id,
          event.actor_id,
          event.entity_type,
          event.entity_id,
          payload,
          event.occurred_at,
          event.received_at,
          event.confidence,
          metadata,
        ],
      );
      if (cols.has("created_at")) {
        run(this.db, "UPDATE events SET created_at = ? WHERE id = ? AND (created_at IS NULL OR created_at = '')", [
          event.received_at,
          event.id,
        ]);
      }
      return;
    }
    run(
      this.db,
      `INSERT INTO events (id, type, entity_id, occurred_at, payload, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, type = excluded.type`,
      [event.id, event.type, event.entity_id, event.occurred_at, payload, event.source, event.received_at],
    );
  }

  getById(id: string): BusinessEvent | undefined {
    const row = one<EventRow>(this.db, "SELECT * FROM events WHERE id = ?", [id]);
    return row ? toEvent(row) : undefined;
  }

  list(filters: EventListFilters = {}): BusinessEvent[] {
    const where: string[] = [];
    const params: SQLInputValue[] = [];
    if (filters.type) {
      where.push("type = ?");
      params.push(filters.type);
    }
    if (filters.entity_type) {
      where.push("entity_type = ?");
      params.push(filters.entity_type);
    }
    if (filters.entity_id) {
      where.push("entity_id = ?");
      params.push(filters.entity_id);
    }
    if (filters.source) {
      where.push("source = ?");
      params.push(filters.source);
    }
    if (filters.from) {
      where.push("occurred_at >= ?");
      params.push(filters.from);
    }
    if (filters.to) {
      where.push("occurred_at <= ?");
      params.push(filters.to);
    }
    const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
    const sql = `SELECT * FROM events ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY occurred_at ASC, id ASC LIMIT ?`;
    return all<EventRow>(this.db, sql, [...params, limit]).map(toEvent);
  }

  listByEntity(entityType: string, entityId: string): BusinessEvent[] {
    return this.list({ entity_type: entityType, entity_id: entityId });
  }

  listByType(type: string): BusinessEvent[] {
    return this.list({ type });
  }

  listByTimeRange(from: string, to: string): BusinessEvent[] {
    return this.list({ from, to });
  }

  /** Operator counter only. Does not rewrite type, payload, or timestamps. */
  updateMetadata(id: string, metadata: Record<string, unknown>) {
    const cols = columnNames(this.db);
    if (!cols.has("metadata")) return;
    run(this.db, "UPDATE events SET metadata = ? WHERE id = ?", [JSON.stringify(metadata), id]);
  }

  findIdempotent(source: string, sourceId: string, type: string): BusinessEvent | undefined {
    const row = one<EventRow>(
      this.db,
      "SELECT * FROM events WHERE source = ? AND source_id = ? AND type = ?",
      [source, sourceId, type],
    );
    return row ? toEvent(row) : undefined;
  }
}

function columnNames(db: DatabaseSync): Set<string> {
  return new Set(all<{ name: string }>(db, "PRAGMA table_info(events)").map((c) => c.name));
}

export function toEvent(row: EventRow): BusinessEvent {
  return {
    id: row.id,
    type: row.type,
    source: row.source,
    source_id: row.source_id ?? null,
    actor_id: row.actor_id ?? null,
    entity_type: row.entity_type ?? null,
    entity_id: row.entity_id ?? null,
    payload: parseJson(row.payload),
    occurred_at: row.occurred_at,
    received_at: row.received_at || row.created_at || row.occurred_at,
    confidence: typeof row.confidence === "number" ? row.confidence : 1,
    metadata: parseJson(row.metadata),
  };
}

function parseJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
