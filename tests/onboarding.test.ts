import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AuthError, AuthService, resetControlDbHandle } from "../lib/auth";
import { DiscoveryService } from "../lib/discovery/service";
import { IntegrationService } from "../lib/integrations/service";
import { OnboardingService } from "../lib/onboarding/service";
import { openWorkspaceDb } from "../lib/workspace/db";
import { readFileSync } from "node:fs";
import { ConnectorService } from "../lib/connectors";
import { getDb, getMeta } from "../lib/db";
import { calculateGraphImpact } from "../lib/engine/impact";
import { IDS } from "../lib/ids";

const dir = mkdtempSync(join(tmpdir(), "ep-onboard-"));
process.env.CONTROL_DB_PATH = join(dir, "control.db");
process.env.DB_PATH = join(dir, "atlas.db");
process.env.WORKSPACE_DB_DIR = join(dir, "workspaces");
resetControlDbHandle();

describe("onboarding", () => {
  it("takes a new workspace from welcome to first Pulse without Atlas data", () => {
    const created = AuthService.signup({
      email: "new@example.com",
      password: "password1",
      name: "Nour",
    });
    const workspaceId = created.workspace.id;
    const db = openWorkspaceDb(workspaceId);

    const business = OnboardingService.saveBusiness(workspaceId, {
      name: "Nour Atelier",
      industry: "retail",
      teamSize: "8",
      country: "Algeria",
      currency: "DZD",
    });
    assert.equal(business.name, "Nour Atelier");
    assert.equal(business.currency, "DZD");

    const protectedWs = OnboardingService.saveProtections(workspaceId, ["revenue", "orders"]);
    assert.deepEqual(protectedWs.protections, ["revenue", "orders"]);

    const connectors = IntegrationService.list(workspaceId);
    assert.ok(connectors.some((item) => item.id === "hubspot" && item.status === "COMING_SOON"));
    IntegrationService.connect(workspaceId, "manual-profile");
    assert.equal(IntegrationService.connectedCount(workspaceId), 1);
    assert.throws(() => IntegrationService.connect(workspaceId, "hubspot"));

    const facts = OnboardingService.runDiscovery(workspaceId, db);
    assert.ok(facts.length >= 6);
    DiscoveryService.correct(workspaceId, "customers", 4, "We have four regulars.");
    const customers = DiscoveryService.list(workspaceId).find((fact) => fact.kind === "customers");
    assert.equal(customers?.count, 4);
    assert.equal(customers?.source, "user-correction");

    const goal = OnboardingService.setFirstGoal(workspaceId, db, "revenue");
    assert.ok(goal.id);
    const first = OnboardingService.firstPulse(workspaceId);
    assert.equal(first.empty, false);
    const finished = OnboardingService.finish(workspaceId);
    assert.equal(finished.onboardingCompleted, true);

    const atlas = db.prepare("SELECT COUNT(*) as n FROM entities WHERE name LIKE '%Atlas%'").get() as { n: number };
    assert.equal(atlas.n, 0);
  });
  it("onboarding validation errors are 400 AuthErrors, not server errors", () => {
    const created = AuthService.signup({ email: `v-${Date.now()}@example.com`, password: "correct-horse-9", name: "Validator" });
    const workspaceId = created.workspace.id;
    assert.throws(
      () => OnboardingService.saveProtections(workspaceId, []),
      (error: unknown) => error instanceof AuthError && error.status === 400 && /Pick at least one/.test(error.message),
    );
    assert.throws(
      () => OnboardingService.saveBusiness(workspaceId, { name: " ", industry: "", teamSize: "", country: "", currency: "DZD" }),
      (error: unknown) => error instanceof AuthError && error.status === 400,
    );
  });
  it("connect step: CSV import lands real data in a new workspace and in its first Pulse", async () => {
    const created = AuthService.signup({ email: `csv-${Date.now()}@example.com`, password: "password-csv-1", name: "Imen" });
    const workspaceId = created.workspace.id;
    const db = openWorkspaceDb(workspaceId);
    OnboardingService.saveBusiness(workspaceId, { name: "Imen Trading", industry: "distribution", teamSize: "5", country: "Algeria", currency: "DZD" });
    OnboardingService.saveProtections(workspaceId, ["cash"]);
    // Imported invoices are due in September 2026; pin the workspace clock after them.
    db.prepare("UPDATE meta SET value = ? WHERE key = 'demo_now'").run("2026-09-27T09:00:00Z");
    const service = ConnectorService.for(db, workspaceId);
    for (const name of ["customers", "orders", "invoices"]) {
      await service.commitImport({ fileName: `${name}.csv`, bytes: readFileSync(`public/samples/${name}.csv`) }, "Imen");
    }
    assert.equal(service.registry.view("csv-import").state, "connected");
    assert.equal(IntegrationService.connectedCount(workspaceId, db), 1);
    const facts = OnboardingService.runDiscovery(workspaceId, db);
    assert.equal(facts.find((f) => f.kind === "invoices")?.count, 3);
    assert.equal(facts.find((f) => f.kind === "invoices")?.confidence, "observed");
    OnboardingService.setFirstGoal(workspaceId, db, "cash");
    const first = OnboardingService.firstPulse(workspaceId, db);
    assert.equal(first.empty, false);
    assert.ok(first.needsYou + first.monitoring >= 1);
    assert.equal(first.connections, 1);
    // Atlas demo company stays canonical and untouched.
    const atlas = getDb();
    assert.equal(calculateGraphImpact(atlas, IDS.shipment).associated_revenue, 850000);
    assert.equal((atlas.prepare("SELECT COUNT(*) AS n FROM entities WHERE id LIKE 'ent_imp_%'").get() as { n: number }).n, 0);
    assert.ok(getMeta(atlas, "demo_now"));
  });
});
