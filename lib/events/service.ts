import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { id } from "../ids";
import { EventDispatcher, getDispatcher } from "./dispatcher";
import { EventRepository } from "./repository";
import {
  EVENT_TYPE_PATTERN,
  KNOWN_EVENT_TYPES,
  type BusinessEvent,
  type EventInput,
  type EventListFilters,
  type ReplayResult,
} from "./types";

const EventInputSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().min(1),
  source: z.string().min(1),
  source_id: z.string().nullable().optional(),
  actor_id: z.string().nullable().optional(),
  entity_type: z.string().nullable().optional(),
  entity_id: z.string().nullable().optional(),
  payload: z.record(z.unknown()).optional(),
  occurred_at: z.string().optional(),
  received_at: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  idempotent: z.boolean().optional(),
});

/**
 * Replay limits (documented for operators and later engines):
 * - Re-dispatch only. Does not re-run ingest / execute / seed side effects.
 * - Does not insert a duplicate event. Replay count is metadata only; type, payload, and timestamps stay as stored.
 * - Handlers must key off event.id so a second dispatch is a no-op.
 * - Failed handlers are logged and skipped; remaining events still replay.
 */
export const REPLAY_LIMITS =
  "Replay re-notifies in-process handlers only. It does not clone the event, re-ingest messages, or re-execute actions. Handlers must be idempotent on event.id.";

export class EventService {
  constructor(
    private readonly repo: EventRepository,
    private readonly dispatcher: EventDispatcher,
  ) {}

  create(input: EventInput): BusinessEvent {
    return this.append(input);
  }

  append(input: EventInput): BusinessEvent {
    const parsed = EventInputSchema.parse(input);
    validateType(parsed.type);
    if (parsed.entity_id && !parsed.entity_type) {
      throw new Error("entity_type is required when entity_id is set");
    }
    if (parsed.occurred_at) assertIso(parsed.occurred_at, "occurred_at");
    if (parsed.received_at) assertIso(parsed.received_at, "received_at");

    if (parsed.idempotent && parsed.source_id) {
      const existing = this.repo.findIdempotent(parsed.source, parsed.source_id, parsed.type);
      if (existing) return existing;
    }
    if (parsed.id) {
      const existing = this.repo.getById(parsed.id);
      if (existing && parsed.idempotent) return existing;
    }

    const now = new Date().toISOString();
    const event: BusinessEvent = {
      id: parsed.id || id("evt"),
      type: parsed.type,
      source: parsed.source,
      source_id: parsed.source_id ?? null,
      actor_id: parsed.actor_id ?? null,
      entity_type: parsed.entity_type ?? null,
      entity_id: parsed.entity_id ?? null,
      payload: (parsed.payload as Record<string, unknown>) ?? {},
      occurred_at: parsed.occurred_at || now,
      received_at: parsed.received_at || now,
      confidence: parsed.confidence ?? 1,
      metadata: (parsed.metadata as Record<string, unknown>) ?? {},
    };
    this.repo.persist(event);
    this.dispatcher.dispatch(event);
    return event;
  }

  getById(id: string) {
    return this.repo.getById(id);
  }

  list(filters: EventListFilters = {}) {
    return this.repo.list(filters);
  }

  listByEntity(entityType: string, entityId: string) {
    return this.repo.listByEntity(entityType, entityId);
  }

  listByType(type: string) {
    return this.repo.listByType(type);
  }

  listByTimeRange(from: string, to: string) {
    return this.repo.listByTimeRange(from, to);
  }

  async replay(eventId: string): Promise<ReplayResult> {
    const event = this.repo.getById(eventId);
    if (!event) throw new Error("Event not found");
    const stamped = stampReplay(event);
    this.repo.updateMetadata(event.id, stamped.metadata);
    this.dispatcher.dispatch({ ...event, metadata: { ...stamped.metadata, replay: true } });
    return { replayed: [{ ...event, metadata: stamped.metadata }], skipped: [], note: REPLAY_LIMITS };
  }

  async replaySequence(options: {
    from_id?: string;
    entity_type?: string;
    entity_id?: string;
  }): Promise<ReplayResult> {
    let events = options.entity_type && options.entity_id
      ? this.repo.listByEntity(options.entity_type, options.entity_id)
      : this.repo.list({ limit: 500 });

    if (options.from_id) {
      const start = events.findIndex((e) => e.id === options.from_id);
      if (start === -1) {
        const one = this.repo.getById(options.from_id);
        if (!one) throw new Error("from_id not found");
        events = this.repo.list({ from: one.occurred_at }).filter((e) => {
          if (e.occurred_at > one.occurred_at) return true;
          return e.occurred_at === one.occurred_at && e.id >= one.id;
        });
      } else {
        events = events.slice(start);
      }
    }

    const replayed: BusinessEvent[] = [];
    for (const event of events) {
      const stamped = stampReplay(event);
      this.repo.updateMetadata(event.id, stamped.metadata);
      this.dispatcher.dispatch({ ...event, metadata: { ...stamped.metadata, replay: true } });
      replayed.push({ ...event, metadata: stamped.metadata });
    }
    return { replayed, skipped: [], note: REPLAY_LIMITS };
  }
}

export function eventsFor(db: DatabaseSync): EventService {
  return new EventService(new EventRepository(db), getDispatcher());
}

function validateType(type: string) {
  if (KNOWN_EVENT_TYPES.has(type)) return;
  if (EVENT_TYPE_PATTERN.test(type)) return;
  throw new Error(`Invalid event type "${type}". Use a known type or dotted namespace.action.`);
}

function assertIso(value: string, field: string) {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`${field} must be a valid ISO timestamp`);
}

function stampReplay(event: BusinessEvent): BusinessEvent {
  const count = Number(event.metadata.replay_count ?? 0) + 1;
  return {
    ...event,
    metadata: {
      ...event.metadata,
      replay_count: count,
      last_replayed_at: new Date().toISOString(),
    },
  };
}
