import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { getDb } from "../lib/db";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { IDS } from "../lib/ids";
import { loadSnapshot, runSimulation, SimulationError, simulateSnapshot, stateFingerprint } from "../lib/simulation";
import { ATLAS_SUPPLY_FIXTURE } from "./fixtures/atlas-supply";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-sim-")), "sim.db");

const PLUS_3 = { type: "supplier_delay", targetId: IDS.shipment, days: 3 } as const;
const WEDNESDAY = "2026-09-30T09:00:00+01:00";
const SATURDAY = "2026-10-03T09:00:00+01:00";

describe("Business Simulator on the live Business Twin", { concurrency: 1 }, () => {
  it("works before any delay is reported (Monday → Thursday)", () => {
    const db = getDb();
    const result = runSimulation(db, PLUS_3);
    assert.equal(result.source, "business_graph");
    assert.equal(result.baseline.shipmentArrival, "2026-09-28T09:00:00+01:00");
    assert.equal(result.simulated.shipmentArrival, "2026-10-01T09:00:00+01:00");
    assert.equal(result.baseline.commitmentsMissed.length, 0);
    assert.deepEqual(result.delta.customersAffected.added.map((c) => c.label), ["Oran Fresh Market"]);
    assert.equal(result.delta.cash.movedToNextPeriod, 0);
    assert.equal(result.isolation.unchanged, true);
  });

  it("DoD: SH-204 Wednesday +3 days → Saturday IN SIMULATION ONLY, consequences recalculated", () => {
    const db = getDb();
    triggerSupplierDelay(db); // real business: Atlas Supply now expected Wednesday
    const before = stateFingerprint(db);
    const counts = rowCounts(db);

    const result = runSimulation(db, PLUS_3);

    assert.equal(result.mode, "SIMULATION");
    assert.equal(result.baseline.shipmentArrival, WEDNESDAY);
    assert.equal(result.simulated.shipmentArrival, SATURDAY);
    assert.equal(new Date(SATURDAY).getUTCDay(), 6);
    assert.equal(result.delta.shipmentShiftDays, 3);

    // Baseline: Order A's Tuesday delivery is already missed because of the Wednesday arrival.
    assert.deepEqual(result.baseline.commitmentsMissed.map((c) => c.id), [IDS.commitDeliverA]);
    assert.equal(result.baseline.cashInPeriod, 540000);

    assert.deepEqual(result.delta.commitmentsMissed.added.map((c) => c.id).sort(), [IDS.commitShip, IDS.orderB].sort());
    assert.deepEqual(result.delta.customersAffected.added.map((c) => c.label), ["Constantine Clinic"]);
    assert.equal(result.delta.revenueAtRisk.delta, 280000);
    assert.equal(result.delta.cash.movedToNextPeriod, 540000);
    assert.deepEqual(result.delta.headline, [
      "+2 commitments missed",
      "+1 customer deadline affected",
      "540,000 DZD cash moves into next period",
    ]);

    // Order C has slack: it moves three days but still meets its deadline.
    const orderC = result.changes.find((c) => c.id === IDS.orderC);
    assert.equal(orderC?.simulated.late, false);
    assert.equal(orderC?.shiftDays, 3);

    // Exit: reality is completely unchanged.
    assert.equal(result.isolation.unchanged, true);
    assert.equal(result.isolation.fingerprintBefore, before.hash);
    assert.equal(stateFingerprint(db).hash, before.hash);
    assert.deepEqual(rowCounts(db), counts);
    const shipment = db.prepare("SELECT metadata FROM graph_nodes WHERE id = ?").get(IDS.shipment) as { metadata: string };
    assert.equal(JSON.parse(shipment.metadata).expectedAt, WEDNESDAY);
    const expectation = db.prepare("SELECT due_at FROM expectations WHERE id = ?").get(IDS.expectShip) as { due_at: string };
    assert.equal(expectation.due_at, WEDNESDAY);
  });

  it("WHY follows actual Business Graph edges from the supplier to each consequence", () => {
    const db = getDb();
    const result = runSimulation(db, PLUS_3);
    const edgeIds = new Set(
      (db.prepare("SELECT id FROM graph_edges").all() as { id: string }[]).map((e) => e.id),
    );

    const orderB = result.changes.find((c) => c.id === IDS.orderB);
    assert.deepEqual(
      orderB?.why.steps.map((s) => s.nodeId),
      [IDS.supplier, IDS.shipment, IDS.product, IDS.orderB],
    );
    assert.deepEqual(orderB?.why.steps.map((s) => s.edgeId), [null, "ge_sup_ship", "ge_ship_prod", "ge_prod_ob"]);

    assert.ok(result.changes.length >= 10);
    for (const change of result.changes) {
      assert.equal(change.why.steps[0].nodeId, IDS.supplier, `${change.id} path starts at the supplier`);
      assert.equal(change.why.steps.at(-1)!.nodeId, change.id);
      for (const step of change.why.steps.slice(1)) {
        assert.ok(step.edgeId && edgeIds.has(step.edgeId), `${change.id}: ${step.edgeId} is a real graph edge`);
      }
    }
    const invoiceA = result.changes.find((c) => c.id === IDS.invoiceA);
    assert.match(invoiceA!.why.explanation, /Atlas Supply —supplies→ Shipment SH-204 .*—produces→ Invoice A/);
  });

  it("rejects invalid scenarios without touching state", () => {
    const db = getDb();
    const before = stateFingerprint(db).hash;
    assert.throws(() => runSimulation(db, { ...PLUS_3, days: 0 }), SimulationError);
    assert.throws(() => runSimulation(db, { ...PLUS_3, days: 2.5 }), SimulationError);
    assert.throws(() => runSimulation(db, { ...PLUS_3, targetId: "nope" }), SimulationError);
    assert.throws(() => runSimulation(db, { ...PLUS_3, targetId: IDS.orderA }), SimulationError);
    assert.throws(() => runSimulation(db, null), SimulationError);
    assert.equal(stateFingerprint(db).hash, before);
  });
});

describe("Simulation engine (pure)", () => {
  it("fixture mirrors the seeded graph after the supplier delay", () => {
    const live = runSimulation(getDb(), PLUS_3);
    const fixture = simulateSnapshot(ATLAS_SUPPLY_FIXTURE, PLUS_3);
    assert.deepEqual(fixture.baseline, live.baseline);
    assert.deepEqual(fixture.simulated, live.simulated);
    assert.deepEqual(fixture.delta, live.delta);
    assert.equal(loadSnapshot(getDb()).nodes.find((n) => n.type === "cash")?.attrs.periodEnd, "2026-10-04T23:59:00+01:00");
  });

  it("is proportional: +1 day is absorbed by slack on customer deadlines and cash", () => {
    const result = simulateSnapshot(ATLAS_SUPPLY_FIXTURE, { ...PLUS_3, days: 1 });
    assert.deepEqual(result.delta.commitmentsMissed.added.map((c) => c.id), [IDS.commitShip]);
    assert.equal(result.delta.customersAffected.delta, 0);
    assert.equal(result.delta.cash.movedToNextPeriod, 0);
  });

  it("keeps other upstream inputs of affected nodes (a second, later shipment)", () => {
    const snapshot = structuredClone(ATLAS_SUPPLY_FIXTURE);
    snapshot.nodes.push(
      { id: "ship_2", type: "shipment", label: "Shipment SH-205", attrs: { expectedAt: "2026-10-03T09:00:00+01:00" } },
      { id: "prod_2", type: "product", label: "Brackets BR-2", attrs: {} },
    );
    snapshot.edges.push(
      { id: "e_s2_p2", from: "ship_2", to: "prod_2", relationship: "contains" },
      { id: "e_p2_ob", from: "prod_2", to: IDS.orderB, relationship: "required_by" },
    );
    const result = simulateSnapshot(snapshot, { ...PLUS_3, days: 1 });
    // Order B already waits on SH-205 (Saturday) in the baseline, so it is late before the scenario.
    assert.ok(result.baseline.ordersLate.some((o) => o.id === IDS.orderB));
    assert.equal(result.delta.customersAffected.delta, 0);
  });

  it("never mutates the snapshot it was given", () => {
    const before = structuredClone(ATLAS_SUPPLY_FIXTURE);
    simulateSnapshot(ATLAS_SUPPLY_FIXTURE, PLUS_3);
    simulateSnapshot(ATLAS_SUPPLY_FIXTURE, { ...PLUS_3, days: 7 });
    assert.deepEqual(ATLAS_SUPPLY_FIXTURE, before);
  });
});

function rowCounts(db: DatabaseSync) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  return Object.fromEntries(
    tables.map((t) => [t.name, (db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get() as { n: number }).n]),
  );
}
