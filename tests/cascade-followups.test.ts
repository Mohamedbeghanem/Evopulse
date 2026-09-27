import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { refreshExpectations } from "../lib/engine/expectations";
import { businessGraph } from "../lib/engine/graph";
import { pulseSummary } from "../lib/engine/pulse";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { IDS } from "../lib/ids";
import type { ExpectationRow } from "../lib/types";

// Restored from closed PR #9 (b9bbe21): the two fixes that did not survive the #10 squash.
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

  it("Order A delivery and SH-204 stay AT_RISK after Pulse recomputes expectations", () => {
    const db = getDb();
    triggerSupplierDelay(db);
    // One pass. refreshExpectations settles the cascade itself, so this no longer needs calling twice.
    pulseSummary(db, getMeta(db, "demo_now"));
    assert.equal(expectation(IDS.expectDeliverA).status, "AT_RISK");
    assert.equal(expectation(IDS.expectShip).status, "AT_RISK");
  });

  it("the risk signal never masks MISSED once a deadline passes", () => {
    const db = getDb();
    refreshExpectations(db, "2026-09-29T11:00:00+01:00"); // Tuesday, one hour after Order A's deadline
    assert.equal(expectation(IDS.expectDeliverA).status, "MISSED");
    assert.equal(expectation(IDS.expectShip).status, "AT_RISK");
    refreshExpectations(db, "2026-09-30T10:00:00+01:00"); // Wednesday, one hour after the revised arrival
    assert.equal(expectation(IDS.expectShip).status, "MISSED");
    assert.equal(expectation(IDS.expectDeliverA).status, "MISSED", "Wed: SH-204 missed; Order A stays MISSED");
    for (const at of ["2026-10-01T12:00:00+01:00", "2026-10-03T12:00:00+01:00"]) {
      refreshExpectations(db, at); // Thursday, Saturday — one call each, the cascade settles in-pass
      assert.equal(expectation(IDS.expectDeliverA).status, "MISSED", `Order A still MISSED at ${at}`);
    }
  });

  it("the 320K decision stays BLOCKED by the missed proposal", () => {
    const db = getDb();
    for (const at of [getMeta(db, "demo_now"), "2026-10-03T12:00:00+01:00"]) {
      refreshExpectations(db, at);
      assert.equal(expectation(IDS.expectTheirs).status, "BLOCKED", `their decision at ${at}`);
    }
  });
});
