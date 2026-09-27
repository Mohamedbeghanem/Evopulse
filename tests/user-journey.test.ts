import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "ep-journey-"));
process.env.CONTROL_DB_PATH = join(dir, "control.db");
process.env.WORKSPACE_DB_DIR = join(dir, "workspaces");

const { AuthService } = await import("../lib/auth");
const { OnboardingService } = await import("../lib/onboarding/service");
const { openWorkspaceDb } = await import("../lib/workspace/db");
const { CommandRouter } = await import("../lib/command");

describe("new user golden path", () => {
  it("creates an account, finishes onboarding, asks what needs me, and restores the workspace after login", () => {
    const signup = AuthService.signup({
      email: "path@example.com",
      password: "password1",
      name: "Path",
    });
    const workspaceId = signup.workspace.id;
    const db = openWorkspaceDb(workspaceId);
    OnboardingService.saveBusiness(workspaceId, {
      name: "Path Goods",
      industry: "wholesale",
      teamSize: "5",
      country: "Algeria",
      currency: "DZD",
    });
    OnboardingService.saveProtections(workspaceId, ["customers"]);
    OnboardingService.runDiscovery(workspaceId, db);
    OnboardingService.setFirstGoal(workspaceId, db, "customers");
    OnboardingService.finish(workspaceId);

    const answer = new CommandRouter(db).route("What needs me?");
    assert.ok(answer.summary);
    assert.notEqual(answer.intent, "UNKNOWN");

    AuthService.logout(signup.session.token);
    const login = AuthService.login({ email: "path@example.com", password: "password1" });
    assert.equal(login.workspace?.id, workspaceId);
    assert.equal(login.workspace?.name, "Path Goods");
    assert.equal(login.workspace?.onboardingCompleted, true);
  });
});
