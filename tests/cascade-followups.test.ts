import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { refreshExpectations } from "../lib/engine/expectations";
import { businessGraph } from "../lib/engine/graph";
import { calculateGraphImpact } from "../lib/engine/impact";
import { pulseSummary } from "../lib/engine/pulse";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { EVENT_TYPES, eventsFor } from "../lib/events";
import { IDS } from "../lib/ids";
import type { ExpectationRow } from "../lib/types";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-casfix-")), "cascade-fix.db");
resetDbFile();

function expectation(id: string) {
  return getDb().prepare("SELECT * FROM expectations WHERE id = ?").get(id) as ExpectationRow;
}

describe("supplier cascade follow-ups", { concurrency: 1 }, () => {
  it("graph page keeps 320K entities, has no dangling edges, and shows commitment status", () => {
    const graph = businessGraph(getDb());
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const id of [IDS.contact, IDS.company, IDS.opportunity]) assert.ok(ids.has(id), `${id} present`);
    for (const edge of graph.edges) {
      assert.ok(ids.has(edge.from) && ids.has(edge.to), `edge ${edge.from} → ${edge.to} has both ends`);
    }
    assert.equal(ids.size, graph.nodes.length, "no duplicate nodes");
    const sendProposal = graph.nodes.find((n) => n.id === IDS.commitOurs);
    assert.ok(sendProposal?.status, "missed proposal commitment shows its status");
  });

  it("records an order.affected event for every affected order", () => {
    const db = getDb();
    triggerSupplierDelay(db);
    const affected = eventsFor(db)
      .list()
      .filter((e) => e.type === EVENT_TYPES.ORDER_AFFECTED)
      .map((e) => e.entity_id)
      .sort();
    assert.deepEqual(affected, [IDS.orderA, IDS.orderB, IDS.orderC].sort());
    // Idempotent: a second trigger adds nothing.
    triggerSupplierDelay(db);
    assert.equal(eventsFor(db).list().filter((e) => e.type === EVENT_TYPES.ORDER_AFFECTED).length, 3);
  });

  it("Order A delivery stays AT_RISK after Pulse recomputes expectations", () => {
    const db = getDb();
    pulseSummary(db, getMeta(db, "demo_now"));
    pulseSummary(db, getMeta(db, "demo_now"));
    assert.equal(expectation(IDS.expectDeliverA).status, "AT_RISK");
    assert.equal(expectation(IDS.expectShip).status, "AT_RISK");
  });

  it("scopes commitments_at_risk to the queried node's downstream", () => {
    const db = getDb();
    assert.equal(calculateGraphImpact(db, IDS.orderC).commitments_at_risk, 0);
    assert.equal(calculateGraphImpact(db, IDS.orderA).commitments_at_risk, 1);
    assert.equal(calculateGraphImpact(db, IDS.shipment).commitments_at_risk, 2);
  });

  it("a revised expectation still becomes MISSED once its new deadline passes", () => {
    const db = getDb();
    refreshExpectations(db, "2026-09-30T10:00:00+01:00"); // Wednesday, one hour after revised arrival
    assert.equal(expectation(IDS.expectShip).status, "MISSED");
  });
});
