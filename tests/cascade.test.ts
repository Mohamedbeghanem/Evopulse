import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { SHIP_DELAYED_ISO, SHIP_EXPECTED_ISO } from "../lib/clock";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { calculateGraphImpact } from "../lib/engine/impact";
import { executePlan } from "../lib/engine/execute";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { pulseSummary } from "../lib/engine/pulse";
import { wipeAndSeed } from "../lib/seed";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { businessTwin } from "../lib/engine/twin";
import { EVENT_TYPES, eventsFor } from "../lib/events";
import { getDownstream, graphFor } from "../lib/graph";
import { IDS } from "../lib/ids";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-cas-")), "cascade.db");
resetDbFile();

describe("supplier cascade", { concurrency: 1 }, () => {
  it("seeds graph nodes and edges for Atlas Supply → SH-204 → orders", () => {
    const db = getDb();
    const { start, hits } = getDownstream(db, IDS.supplier);
    assert.ok(start);
    assert.equal(start?.id, IDS.supplier);
    const types = new Set(hits.map((h) => h.node.type));
    assert.ok(types.has("shipment"));
    assert.ok(types.has("product"));
    assert.ok(types.has("order"));
    assert.ok(hits.some((h) => h.node.id === IDS.shipment));
    assert.ok(hits.some((h) => h.node.id === IDS.orderA));
    assert.ok(hits.some((h) => h.node.id === IDS.orderB));
    assert.ok(hits.some((h) => h.node.id === IDS.orderC));
    const visited = new Set(hits.map((h) => h.node.id));
    assert.equal(visited.size, hits.length);
  });

  it("does not recurse infinitely on a cycle", () => {
    const db = getDb();
    graphFor(db).upsertEdge({
      id: "ge_test_cycle",
      source_node_id: IDS.orderA,
      target_node_id: IDS.shipment,
      relationship: "related_to",
    });
    const { hits } = getDownstream(db, IDS.shipment, 20);
    assert.ok(hits.length < 50);
    const ids = hits.map((h) => h.node.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("calculates 3/3/850K/540K from graph amounts, not a hardcoded total", () => {
    const db = getDb();
    const before = calculateGraphImpact(db, IDS.shipment);
    assert.equal(before.affected_orders.length, 3);
    assert.equal(before.affected_customers.length, 3);
    assert.equal(
      before.affected_orders.reduce((s, o) => s + o.amount, 0),
      850000,
    );
    assert.equal(before.associated_revenue, 850000);
    assert.equal(
      before.affected_invoices.reduce((s, i) => s + i.amount, 0),
      540000,
    );
    assert.equal(before.affected_expected_cash, 540000);
    assert.ok(before.paths.some((p) => p.nodeIds.includes(IDS.orderA)));
    assert.ok(before.notes.includes("not a claim"));
  });

  it("records Monday → Wednesday +2 and a delivery_delay exception", () => {
    const db = getDb();
    assert.equal(getMeta(db, "supplier_phase", "stable"), "stable");
    const result = triggerSupplierDelay(db);
    assert.equal(result.change?.original_due_at, SHIP_EXPECTED_ISO);
    assert.equal(result.change?.new_due_at, SHIP_DELAYED_ISO);
    assert.equal(result.change?.delta_days, 2);
    assert.equal(result.expectation?.due_at, SHIP_DELAYED_ISO);
    assert.equal(result.exception?.kind, "delivery_delay");
    assert.equal(result.exception?.status, "open");
    assert.equal(result.deliveryAtRisk && (result.deliveryAtRisk as { status: string }).status, "at_risk");
    assert.ok((result.impact.commitments_at_risk ?? 0) >= 1);

    const types = new Set(eventsFor(db).list().map((e) => e.type));
    assert.ok(types.has(EVENT_TYPES.MESSAGE_RECEIVED));
    assert.ok(types.has(EVENT_TYPES.SHIPMENT_EXPECTED));
    assert.ok(types.has(EVENT_TYPES.SHIPMENT_DELAYED));
    assert.ok(types.has(EVENT_TYPES.ORDER_AFFECTED));
    assert.ok(types.has(EVENT_TYPES.EXCEPTION_CREATED));

    const twin = businessTwin(db);
    const ops = twin.domains.find((d) => d.id === "OPERATIONS");
    const cash = twin.domains.find((d) => d.id === "CASH");
    const suppliers = twin.domains.find((d) => d.id === "SUPPLIERS");
    assert.equal(ops?.status, "AT_RISK");
    assert.equal(cash?.status, "MONITORING");
    assert.equal(cash?.attention_value, 540000);
    assert.equal(suppliers?.status, "AT_RISK");
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    assert.match(pulse.headline, /2 critical|850/);
    assert.ok(pulse.exceptions.some((e) => e.id === IDS.excDelay));
  });

  it("reset restores the supplier baseline", () => {
    const db = getDb();
    wipeAndSeed(db);
    assert.equal(getMeta(db, "supplier_phase", "stable"), "stable");
    const exp = triggerSupplierDelay(db);
    assert.equal(exp.exception?.kind, "delivery_delay");
    wipeAndSeed(db);
    assert.equal(getMeta(db, "supplier_phase"), "stable");
    const after = calculateGraphImpact(db, IDS.shipment);
    assert.equal(after.associated_revenue, 850000);
    const events = eventsFor(db).listByType(EVENT_TYPES.SHIPMENT_DELAYED);
    assert.equal(events.length, 0);
  });
});

describe("PR #1 regression after cascade seed", () => {
  it("320K recover → 10% BLOCKED still works", async () => {
    process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-reg-")), "loop.db");
    resetDbFile();
    const db = getDb();
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    assert.match(pulse.headline, /320/);
    assert.equal(pulse.counts.NEEDS_YOU, 1);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    const pulseAfter = pulseSummary(db, getMeta(db, "demo_now"));
    assert.equal(pulseAfter.counts.NEEDS_YOU, 0);
    await ingestSeedDiscount(db);
    assert.equal(getMeta(db, "demo_phase"), "discount_blocked");
    const pulseBlock = pulseSummary(db, getMeta(db, "demo_now"));
    const blocked = pulseBlock.exceptions.find((e) => e.id === IDS.excDiscount);
    assert.equal(blocked?.attention, "NEEDS_YOU");
  });
});
