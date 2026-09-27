import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AuthService, ForbiddenError, resetControlDbHandle } from "../lib/auth";
import { openWorkspaceDb } from "../lib/workspace/db";

const dir = mkdtempSync(join(tmpdir(), "ep-auth-"));
process.env.CONTROL_DB_PATH = join(dir, "control.db");
process.env.WORKSPACE_DB_DIR = join(dir, "workspaces");
resetControlDbHandle();

describe("user account lifecycle", () => {
  it("signs up, signs in, rejects a bad password, and isolates sessions", () => {
    const created = AuthService.signup({
      email: "owner@example.com",
      password: "correct-horse",
      name: "Amira",
    });
    assert.equal(created.user.email, "owner@example.com");
    assert.ok(created.workspace.id.startsWith("ws_"));
    assert.equal(created.workspace.agentName, "Pulse");
    assert.equal(created.workspace.onboardingCompleted, false);
    assert.ok(created.verifyToken);

    AuthService.verifyEmail(created.verifyToken);
    const session = AuthService.sessionFromToken(created.session.token);
    assert.ok(session?.user?.emailVerified);

    const login = AuthService.login({ email: "Owner@example.com", password: "correct-horse" });
    assert.equal(login.user.id, created.user.id);
    assert.equal(login.workspace?.id, created.workspace.id);

    assert.throws(
      () => AuthService.login({ email: "owner@example.com", password: "wrong-password" }),
      /incorrect/,
    );

    AuthService.logout(login.session.token);
    assert.equal(AuthService.sessionFromToken(login.session.token), null);
  });

  it("resets a password and invalidates old sessions", () => {
    const created = AuthService.signup({
      email: "reset@example.com",
      password: "old-password",
      name: "Reset",
    });
    const { resetToken } = AuthService.requestPasswordReset("reset@example.com");
    assert.ok(resetToken);
    AuthService.resetPassword(resetToken!, "new-password");
    assert.equal(AuthService.sessionFromToken(created.session.token), null);
    const login = AuthService.login({ email: "reset@example.com", password: "new-password" });
    assert.equal(login.user.email, "reset@example.com");
  });

  it("denies a user who is not a member of another workspace", () => {
    const a = AuthService.signup({ email: "a@example.com", password: "password1", name: "Ada" });
    const b = AuthService.signup({ email: "b@example.com", password: "password2", name: "Bea" });
    assert.throws(() => AuthService.switchWorkspace(b.session.token, a.workspace.id), ForbiddenError);
  });

  it("opens an empty business database for a new workspace", () => {
    const created = AuthService.signup({
      email: "empty@example.com",
      password: "password1",
      name: "Empty",
    });
    const db = openWorkspaceDb(created.workspace.id);
    const entities = db.prepare("SELECT COUNT(*) as n FROM entities").get() as { n: number };
    const policies = db.prepare("SELECT COUNT(*) as n FROM policies").get() as { n: number };
    assert.equal(entities.n, 0);
    assert.ok(policies.n >= 5);
  });
});
