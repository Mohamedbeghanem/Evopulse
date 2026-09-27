import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, resetDbFile } from "../lib/db";
import { EVENT_TYPES, EventRepository, EventService, eventsFor, getDispatcher } from "../lib/events";
import { ingestMessage, ingestSeedDiscount } from "../lib/engine/ingest";
import { IDS } from "../lib/ids";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-evt-")), "events.db");
resetDbFile();

describe("EventRepository + EventService", { concurrency: 1 }, () => {
  it("persists, gets by id, and lists by entity / type / time range", () => {
    const db = getDb();
    const repo = new EventRepository(db);
    const seeded = repo.getById(IDS.message1);
    assert.ok(seeded);
    assert.equal(seeded?.type, EVENT_TYPES.MESSAGE_RECEIVED);

    const byEntity = repo.listByEntity("contact", IDS.contact);
    assert.ok(byEntity.some((e) => e.id === IDS.message1));

    const byType = repo.listByType(EVENT_TYPES.COMMITMENT_MISSED);
    assert.equal(byType.length, 1);
    assert.equal(byType[0].entity_id, IDS.commitOurs);

    const range = repo.listByTimeRange("2026-09-23T00:00:00+01:00", "2026-09-23T23:59:59+01:00");
    assert.ok(range.some((e) => e.type === EVENT_TYPES.MESSAGE_RECEIVED));
    assert.ok(range.every((e) => e.occurred_at >= "2026-09-23T00:00:00+01:00"));
  });

  it("rejects invalid types and missing entity_type", () => {
    const service = eventsFor(getDb());
    assert.throws(() => service.append({ type: "not-a-type", source: "test" }), /Invalid event type/);
    assert.throws(
      () => service.append({ type: EVENT_TYPES.ORDER_CREATED, source: "test", entity_id: "x" }),
      /entity_type is required/,
    );
  });

  it("notifies registered dispatcher handlers after persist", () => {
    const db = getDb();
    const dispatcher = getDispatcher();
    const seen: string[] = [];
    const off = dispatcher.on(EVENT_TYPES.ORDER_CREATED, (event) => {
      seen.push(event.id);
    });
    const created = eventsFor(db).append({
      type: EVENT_TYPES.ORDER_CREATED,
      source: "test",
      entity_type: "order",
      entity_id: "ord_test",
      payload: { sku: "demo" },
    });
    assert.deepEqual(seen, [created.id]);
    assert.ok(new EventRepository(db).getById(created.id));
    off();
  });

  it("replays a stored event without inserting a duplicate", async () => {
    const db = getDb();
    const service = new EventService(new EventRepository(db), getDispatcher());
    const before = service.listByType(EVENT_TYPES.MESSAGE_RECEIVED).length;
    const seen: string[] = [];
    const off = getDispatcher().on("*", (event) => {
      if (event.metadata.replay) seen.push(event.id);
    });
    const result = await service.replay(IDS.message1);
    off();
    assert.equal(result.replayed.length, 1);
    assert.match(result.note, /re-notifies/i);
    assert.equal(service.listByType(EVENT_TYPES.MESSAGE_RECEIVED).length, before);
    assert.deepEqual(seen, [IDS.message1]);
    const stored = service.getById(IDS.message1);
    assert.equal(stored?.metadata.replay_count, 1);
  });

  it("is idempotent on source + source_id + type", () => {
    const service = eventsFor(getDb());
    const first = service.append({
      type: EVENT_TYPES.PAYMENT_EXPECTED,
      source: "test",
      source_id: "pay_1",
      entity_type: "opportunity",
      entity_id: IDS.opportunity,
      idempotent: true,
    });
    const second = service.append({
      type: EVENT_TYPES.PAYMENT_EXPECTED,
      source: "test",
      source_id: "pay_1",
      entity_type: "opportunity",
      entity_id: IDS.opportunity,
      idempotent: true,
    });
    assert.equal(first.id, second.id);
    assert.equal(service.listByType(EVENT_TYPES.PAYMENT_EXPECTED).length, 1);
  });

  it("rejects a second write of the same id unless the call is idempotent", () => {
    const service = eventsFor(getDb());
    const first = service.append({
      id: "evt_dup_guard",
      type: EVENT_TYPES.ORDER_CREATED,
      source: "test",
      entity_type: "order",
      entity_id: "ord_dup",
      payload: { sku: "original" },
    });
    assert.throws(
      () =>
        service.append({
          id: first.id,
          type: EVENT_TYPES.ORDER_CREATED,
          source: "test",
          entity_type: "order",
          entity_id: "ord_dup",
          payload: { sku: "overwrite" },
        }),
      /already exists/,
    );
    assert.equal(service.getById(first.id)?.payload.sku, "original");

    const replayed = service.append({
      id: first.id,
      type: EVENT_TYPES.ORDER_CREATED,
      source: "test",
      entity_type: "order",
      entity_id: "ord_dup",
      payload: { sku: "ignored" },
      idempotent: true,
    });
    assert.equal(replayed.payload.sku, "original");
  });

  it("keeps the demo discount event when another message mentions 10%", async () => {
    const db = getDb();
    await ingestSeedDiscount(db);
    const other = await ingestMessage(db, "Volume is up 10% this week. No discount requested.", {
      source: "api",
    });
    assert.notEqual(other.eventId, IDS.message2);
    const seed = eventsFor(db).getById(IDS.message2);
    assert.match(String(seed?.payload.text ?? ""), /I'll sign today/);
  });
});

describe("seed event stream", () => {
  it("emits the Atlas miss as typed business events", () => {
    const types = new Set(eventsFor(getDb()).list().map((e) => e.type));
    for (const expected of [
      EVENT_TYPES.DEAL_CREATED,
      EVENT_TYPES.MESSAGE_RECEIVED,
      EVENT_TYPES.COMMITMENT_CREATED,
      EVENT_TYPES.COMMITMENT_MISSED,
      EVENT_TYPES.TIME_ADVANCED,
    ]) {
      assert.ok(types.has(expected), `seed missing ${expected}`);
    }
  });
});
