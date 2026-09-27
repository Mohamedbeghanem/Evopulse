import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CREATE_COMPANY_PREFILL,
  avatarStateFromAgent,
  companyCensus,
  createCompany,
  openDemoCompany,
  resetWorkspace,
  resolveCompanyTemplate,
  returnToCreateSurface,
  workspaceMode,
} from "../lib/company";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { calculateGraphImpact } from "../lib/engine/impact";
import { pulseSummary } from "../lib/engine/pulse";
import { EVENT_TYPES, eventsFor } from "../lib/events";
import { getDownstream } from "../lib/graph";
import { IDS } from "../lib/ids";
import { wipeAndSeed } from "../lib/seed";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-co-")), "company.db");
resetDbFile();

describe("company generation", { concurrency: 1 }, () => {
  it("seeds a full distribution world without changing the canonical 850K path", () => {
    const db = getDb();
    wipeAndSeed(db);
    const census = companyCensus(db);
    assert.equal(census.suppliers, 3);
    assert.equal(census.customers, 12);
    assert.equal(census.orders, 8);
    assert.equal(census.invoices, 6);
    assert.equal(census.commitments, 4);
    assert.equal(workspaceMode(db), "entry");

    const impact = calculateGraphImpact(db, IDS.shipment);
    assert.equal(impact.affected_orders.length, 3);
    assert.equal(impact.affected_customers.length, 3);
    assert.equal(impact.associated_revenue, 850000);
    assert.equal(impact.affected_expected_cash, 540000);

    const fromSupply = new Set(getDownstream(db, IDS.supplier).hits.map((hit) => hit.node.id));
    assert.ok(fromSupply.has(IDS.orderA));
    assert.equal(fromSupply.has("ent_order_d"), false);
    assert.ok(eventsFor(db).listByType(EVENT_TYPES.ORDER_CREATED).some((event) => event.entity_id === "ent_order_d"));
  });

  it("create company feeds existing engines and enters Pulse with Atlas Supply risk", () => {
    const db = getDb();
    const snapshot = createCompany(db, { prompt: CREATE_COMPANY_PREFILL, template: "distribution" });
    assert.equal(snapshot.mode, "running");
    assert.equal(snapshot.companyName, "Atlas Medical Distribution");
    assert.equal(snapshot.census.customers, 12);
    assert.equal(snapshot.canonical.associatedRevenue, 850000);
    assert.equal(snapshot.canonical.expectedCash, 540000);
    assert.equal(snapshot.canonical.orders, 3);
    assert.equal(getMeta(db, "supplier_phase"), "delayed");

    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    assert.ok(pulse.attention.needsMe.some((item) => item.sourceExceptionId === IDS.excDelay));
    assert.ok(pulse.attention.summary.eventsProcessed >= 1);
  });

  it("open demo company is the same Atlas path", () => {
    const db = getDb();
    const snapshot = openDemoCompany(db);
    assert.equal(snapshot.mode, "running");
    assert.equal(snapshot.canonical.associatedRevenue, 850000);
    assert.equal(getMeta(db, "supplier_phase"), "delayed");
  });

  it("new company returns to the create surface; reset restores entry", () => {
    const db = getDb();
    openDemoCompany(db);
    assert.equal(returnToCreateSurface(db).mode, "entry");
    assert.equal(workspaceMode(db), "entry");
    const reset = resetWorkspace(db);
    assert.equal(reset.mode, "entry");
    assert.equal(getMeta(db, "supplier_phase", "stable"), "stable");
  });

  it("refuses demo templates instead of inventing a second engine", () => {
    assert.equal(resolveCompanyTemplate("Create a medical equipment distributor in Algiers").id, "distribution");
    assert.throws(() => createCompany(getDb(), { template: "saas" }), /demo template/);
  });

  it("maps AgentRuntime phases onto Pulse avatar states", () => {
    assert.equal(avatarStateFromAgent("IDLE"), "IDLE");
    assert.equal(avatarStateFromAgent("INTERPRETING"), "THINKING");
    assert.equal(avatarStateFromAgent("RUNNING_TOOL"), "INVESTIGATING");
    assert.equal(avatarStateFromAgent("WAITING_FOR_TOOL"), "INVESTIGATING");
    assert.equal(avatarStateFromAgent("WAITING_FOR_APPROVAL"), "WAITING_FOR_APPROVAL");
    assert.equal(avatarStateFromAgent("EXECUTING"), "EXECUTING");
    assert.equal(avatarStateFromAgent("VERIFYING"), "VERIFYING");
    assert.equal(avatarStateFromAgent("COMPLETE"), "SUCCESS");
    assert.equal(avatarStateFromAgent("FAILED"), "BLOCKED");
    assert.equal(avatarStateFromAgent("COMPLETE", "failed"), "BLOCKED");
    assert.equal(avatarStateFromAgent("INTERPRETING", "waiting_for_approval"), "WAITING_FOR_APPROVAL");
  });
});
