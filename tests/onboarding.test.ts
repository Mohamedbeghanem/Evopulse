import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "ep-onboard-"));
process.env.CONTROL_DB_PATH = join(dir, "control.db");
process.env.WORKSPACE_DB_DIR = join(dir, "workspaces");

const { AuthService } = await import("../lib/auth");
const { OnboardingService } = await import("../lib/onboarding/service");
const { DiscoveryService } = await import("../lib/discovery/service");
const { IntegrationService } = await import("../lib/integrations/service");
const { openWorkspaceDb } = await import("../lib/workspace/db");

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
    assert.ok(facts.every((fact) => fact.confidence !== "observed" || fact.count >= 0));
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
});
