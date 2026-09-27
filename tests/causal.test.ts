import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildCausalExplorer } from "../lib/engine/causal";
import { resetDbFile, getDb } from "../lib/db";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { IDS } from "../lib/ids";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-causal-")), "causal.db");
resetDbFile();

describe("causal explorer", { concurrency: 1 }, () => {
  it("lays out cause, event, dependency, and three order consequences from the graph", () => {
    const model = buildCausalExplorer(getDb());
    const keys = model.columns.map((column) => column.key);
    assert.deepEqual(keys.slice(0, 4), ["cause", "event", "dependency", "orders"]);
    const orders = model.columns.find((column) => column.key === "orders")!.nodes;
    assert.equal(orders.length, 3);
    assert.equal(orders.reduce((sum, node) => sum + (node.amount ?? 0), 0), 850000);
    assert.equal(model.revenueLabel, "850,000 DZD");
    assert.equal(model.cashLabel, "540,000 DZD");
    assert.equal(model.delayed, false);
    const orderB = orders.find((node) => node.id === IDS.orderB);
    assert.ok(orderB);
    assert.equal(orderB.amount, 280000);
    assert.match(orderB.evidence, /RK-7|required_by|Shipment/i);
  });

  it("opens the +2 day cause from the supplier message without inventing the totals", () => {
    triggerSupplierDelay(getDb());
    const model = buildCausalExplorer(getDb());
    assert.equal(model.headline, "SUPPLIER DELAY +2 DAYS");
    assert.equal(model.delayed, true);
    assert.equal(model.deltaDays, 2);
    const shipment = model.columns.find((column) => column.key === "event")!.nodes[0];
    assert.equal(shipment.id, IDS.shipment);
    assert.equal(shipment.source, "Supplier message");
    assert.match(shipment.evidence, /Wednesday/);
    assert.equal(shipment.confidence, 0.96);
    assert.ok(shipment.affected.some((item) => item.id === IDS.orderA));
  });
});
