import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { executePlan } from "../lib/engine/execute";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { eventsFor } from "../lib/events";
import { IDS } from "../lib/ids";
import { TAPE_KINDS, tapeKindForEvent } from "../lib/ui/event-kind";

// Salvaged from closed PR #35 (98255e3): the Timeline promised EXPECTED / OBSERVED / DETECTED /
// PLANNED / EXECUTED / VERIFIED but rendered raw event types. Presentation only.
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-tape-")), "tape.db");
resetDbFile();

describe("Timeline tape kinds (salvaged from #35)", { concurrency: 1 }, () => {
  it("classifies canonical event types", () => {
    assert.equal(tapeKindForEvent("shipment.expected", "seed"), "EXPECTED");
    assert.equal(tapeKindForEvent("commitment.created", "ingest"), "EXPECTED");
    assert.equal(tapeKindForEvent("message.received", "inbox"), "OBSERVED");
    assert.equal(tapeKindForEvent("shipment.delayed", "ingest"), "OBSERVED");
    assert.equal(tapeKindForEvent("commitment.missed", "pulse-engine"), "DETECTED");
    assert.equal(tapeKindForEvent("policy.blocked", "policy-engine"), "DETECTED");
    assert.equal(tapeKindForEvent("order.affected", "impact-engine"), "DETECTED");
    assert.equal(tapeKindForEvent("goal.created", "goal-engine"), "PLANNED");
    assert.equal(tapeKindForEvent("action.executed", "action-engine"), "EXECUTED");
    assert.equal(tapeKindForEvent("quote.sent", "action-engine"), "EXECUTED");
    assert.equal(tapeKindForEvent("verification.resolved", "verification-engine"), "VERIFIED");
  });

  it("a customer reply is evidence, not verification; a failed verification is never VERIFIED", () => {
    assert.equal(tapeKindForEvent("customer.replied", "inbox"), "OBSERVED");
    assert.equal(tapeKindForEvent("verification.failed", "verification-engine"), "DETECTED");
    assert.equal(tapeKindForEvent("verification.created", "verification-engine"), "EXPECTED");
  });

  it("labels every event of the live demo stream with one of the six kinds", async () => {
    const db = getDb();
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    await ingestSeedDiscount(db);
    triggerSupplierDelay(db);
    const stream = eventsFor(db).list({ limit: 500 });
    assert.ok(stream.length > 10);
    const kinds = new Set(stream.map((event) => tapeKindForEvent(event.type, event.source)));
    for (const kind of kinds) assert.ok(TAPE_KINDS.includes(kind));
    for (const kind of ["EXPECTED", "OBSERVED", "DETECTED", "EXECUTED", "VERIFIED"] as const) {
      assert.ok(kinds.has(kind), `stream shows ${kind}`);
    }
    const replied = stream.find((event) => event.type === "customer.replied");
    assert.ok(replied);
    assert.equal(tapeKindForEvent(replied.type, replied.source), "OBSERVED");
  });
});
