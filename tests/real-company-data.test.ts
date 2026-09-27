import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { projectAttention } from "../lib/attention";
import { AGENT_NAMES, agentRoster, businessOverview, businessSnapshot } from "../lib/business";
import { companyCensus } from "../lib/company";
import { all, getDb, getMeta, resetDbFile } from "../lib/db";
import { calculateGraphImpact } from "../lib/engine/impact";
import { pulseSummary } from "../lib/engine/pulse";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { getDownstream } from "../lib/graph";
import { IDS } from "../lib/ids";
import { wipeAndSeed } from "../lib/seed";
import { runSimulation, stateFingerprint } from "../lib/simulation";
import { SUGGESTED_PROMPTS } from "../lib/ui/commands";
import { pulseCounts } from "../lib/ui/pulse-counts";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-real-")), "real.db");
resetDbFile();

const EXTRA_ORDERS = ["ent_order_d", "ent_order_e", "ent_order_f", "ent_order_g", "ent_order_h"];

function count(type: string) {
  return (getDb().prepare("SELECT COUNT(*) AS c FROM entities WHERE type = ?").get(type) as { c: number }).c;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|json)$/.test(name) ? [path] : [];
  });
}

describe("real company data", { concurrency: 1 }, () => {
  it("census 3/12/8/6/4 comes straight from the database", () => {
    const db = getDb();
    wipeAndSeed(db);
    assert.equal(count("supplier"), 3);
    assert.equal(count("customer"), 12);
    assert.equal(count("order"), 8);
    assert.equal(count("invoice"), 6);
    const commitments = (db.prepare("SELECT COUNT(*) AS c FROM commitments").get() as { c: number }).c;
    assert.equal(commitments, 4);
    const overview = businessOverview(db);
    assert.deepEqual(overview.census, companyCensus(db));
    assert.equal(overview.company.name, "Atlas Medical Distribution");
    assert.equal(overview.company.city, "Algiers");
    assert.equal(overview.suppliers.length, 3);
    assert.equal(overview.customers.length, 12);
    assert.equal(overview.orders.length, 8);
    assert.equal(overview.invoices.length, 6);
    assert.equal(overview.commitments.length, 4);
  });

  it("canonical impact stays 3 orders / 3 customers / 850K / 540K", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const impact = calculateGraphImpact(db, IDS.shipment);
    assert.equal(impact.affected_orders.length, 3);
    assert.equal(impact.affected_customers.length, 3);
    assert.equal(impact.associated_revenue, 850000);
    assert.equal(impact.affected_expected_cash, 540000);
    const overview = businessOverview(db);
    assert.equal(overview.canonical.orders, 3);
    assert.equal(overview.canonical.customers, 3);
    assert.equal(overview.canonical.associatedRevenue, 850000);
    assert.equal(overview.canonical.expectedCash, 540000);
  });

  it("+3 days moves 160K Invoice C timing and reality is unchanged", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const before = stateFingerprint(db);
    const overviewBefore = JSON.stringify(businessOverview(db));
    const result = runSimulation(db, { type: "supplier_delay", targetId: IDS.shipment, days: 3 });
    assert.equal(result.delta.cash.movedToNextPeriod, 160000);
    assert.notEqual(result.delta.cash.movedToNextPeriod, 540000);
    assert.equal(result.isolation.unchanged, true);
    assert.equal(stateFingerprint(db).hash, before.hash);
    assert.equal(JSON.stringify(businessOverview(db)), overviewBefore);
  });

  it("extra orders D–H exist but are not on the Atlas Supply → SH-204 → RK-7 cascade", () => {
    const db = getDb();
    wipeAndSeed(db);
    const downstream = new Set(getDownstream(db, IDS.supplier).hits.map((hit) => hit.node.id));
    const overview = businessOverview(db);
    for (const id of EXTRA_ORDERS) {
      const row = overview.orders.find((order) => order.id === id);
      assert.ok(row, `${id} seeded`);
      assert.equal(downstream.has(id), false);
      assert.equal(row.onSupplierPath, false);
    }
    for (const id of [IDS.orderA, IDS.orderB, IDS.orderC]) {
      assert.equal(overview.orders.find((order) => order.id === id)?.onSupplierPath, true);
    }
    const amounts = Object.fromEntries(overview.orders.map((order) => [order.id, order.amount]));
    assert.deepEqual(
      EXTRA_ORDERS.map((id) => amounts[id]),
      [190000, 210000, 85000, 140000, 95000],
    );
  });

  it("business read API matches entities and graph edges", () => {
    const db = getDb();
    wipeAndSeed(db);
    const snapshot = businessSnapshot(db);
    const overview = snapshot.overview;
    for (const type of ["supplier", "customer", "order", "invoice", "product"] as const) {
      const ids = all<{ id: string }>(db, "SELECT id FROM entities WHERE type = ? ORDER BY id", [type]).map((row) => row.id);
      const key = `${type}s` as "suppliers" | "customers" | "orders" | "invoices" | "products";
      assert.deepEqual(overview[key].map((row) => row.id).sort(), ids, type);
    }
    const edges = all<{ source_node_id: string; target_node_id: string; relationship: string }>(
      db,
      "SELECT source_node_id, target_node_id, relationship FROM graph_edges",
    );
    for (const order of overview.orders) {
      const belongs = edges.filter((edge) => edge.source_node_id === order.id && edge.relationship === "belongs_to");
      assert.deepEqual(
        order.links.filter((link) => link.relationship === "belongs_to").map((link) => link.id).sort(),
        belongs.map((edge) => edge.target_node_id).sort(),
      );
    }
    const orderD = overview.orders.find((row) => row.id === "ent_order_d");
    assert.ok(orderD?.links.some((link) => link.name === "CHU Mustapha"));
    const pm4 = overview.products.find((row) => row.sku === "PM-4");
    assert.equal(pm4?.inventory, 8);
    const before = stateFingerprint(db).hash;
    businessSnapshot(db);
    assert.equal(stateFingerprint(db).hash, before, "read API never writes");
  });

  it("Pulse counts equal pulseSummary attention output", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    const s = pulse.attention.summary;
    const counts = pulseCounts(s);
    assert.equal(counts.needsYou, s.needsYou + s.needsApproval);
    assert.equal(counts.monitoring, s.monitoring);
    assert.equal(counts.handled, s.handled + s.autoHandled);
    assert.ok(counts.needsYou >= 1);
    assert.deepEqual(businessSnapshot(db).pulse, counts);
    assert.deepEqual(pulseCounts(projectAttention(db, getMeta(db, "demo_now")).summary), counts);
  });

  it("agent activity is derived from state, not hardcoded", () => {
    const db = getDb();
    wipeAndSeed(db);
    const calm = agentRoster(db, { needsYou: 0, monitoring: 0, handled: 0 });
    assert.deepEqual(
      calm.map((agent) => agent.name),
      ["Pulse", "Revenue Guardian", "Supply Guardian", "Cash Guardian", "Operations Guardian"],
    );
    const calmRevenue = calm.find((agent) => agent.id === "revenue")!;
    assert.equal(calmRevenue.activity.some((line) => line.startsWith("Investigated")), false, "no delay yet");

    triggerSupplierDelay(db);
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    const agents = agentRoster(db, pulseCounts(pulse.attention.summary));
    const by = Object.fromEntries(agents.map((agent) => [agent.id, agent.activity]));
    assert.ok(by.revenue.includes("Investigated Atlas Supply delay"));
    assert.ok(by.revenue.includes("Traced 850,000 DZD associated revenue"));
    assert.ok(by.revenue.includes("Identified 3 affected customers"));
    const plan = db.prepare("SELECT id FROM plans WHERE exception_id = ?").get(IDS.excDelay);
    assert.equal(by.revenue.some((line) => line.startsWith("Prepared recovery plan")), Boolean(plan));

    assert.ok(by.supply.some((line) => line.startsWith("Monitoring Atlas Supply")));
    assert.ok(by.supply.some((line) => line.startsWith("Tracking SH-204")));
    assert.ok(by.supply.includes("Tracing RK-7 → 3 orders"));
    assert.ok(by.supply.includes("Monitoring MedEquip Import"));
    assert.ok(by.supply.includes("Monitoring Sahara Logistics"));

    assert.ok(by.cash.includes("Tracking 540,000 DZD expected cash timing"));
    assert.ok(by.cash.includes("Monitoring Invoice C · 160,000 DZD"));
    assert.ok(by.cash.includes("Monitoring Invoice D · 190,000 DZD"));
    assert.ok(by.cash.includes("Monitoring Invoice E · 210,000 DZD"));
    assert.ok(by.cash.includes("Monitoring Invoice F · 85,000 DZD"));

    assert.ok(by.operations.includes("8 active orders"));
    assert.ok(by.operations.includes("3 suppliers"));
    assert.ok(by.operations.includes("Supply dependency monitoring active"));

    const counts = pulseCounts(pulse.attention.summary);
    assert.equal(by.pulse[0], `${counts.needsYou} need you · ${counts.monitoring} monitoring · ${counts.handled} handled`);

    // Change state → activity changes with it (proves derivation).
    db.prepare("UPDATE entities SET name = 'Sahara Freight' WHERE id = 'ent_sahara'").run();
    const renamed = agentRoster(db, counts).find((agent) => agent.id === "supply")!;
    assert.ok(renamed.activity.includes("Monitoring Sahara Freight"));
    wipeAndSeed(db);
  });

  it("UI source has no developer-facing agent names and no mock company data", () => {
    const files = [...sourceFiles("app"), ...sourceFiles("components")];
    const banned = /EvoPulse (Shell IA|Command UI|Pulse UI)/;
    const mock = /CHU Mustapha|MedEquip Import|Sahara Logistics|Blida Hospital|Order D —/;
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(banned.test(text), false, `${file} has a developer-facing name`);
      assert.equal(mock.test(text), false, `${file} hardcodes seeded company data`);
    }
    assert.deepEqual(Object.values(AGENT_NAMES), [
      "Pulse",
      "Revenue Guardian",
      "Supply Guardian",
      "Cash Guardian",
      "Operations Guardian",
    ]);
    assert.deepEqual([...SUGGESTED_PROMPTS], [
      "What needs me?",
      "What changed today?",
      "Why is 850K at risk?",
      "What if Atlas is another 3 days late?",
      "Protect everything at risk this week.",
    ]);
  });
});
