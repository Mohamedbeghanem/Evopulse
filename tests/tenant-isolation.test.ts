import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AuthService, assertWorkspaceAccess, ForbiddenError, resetControlDbHandle } from "../lib/auth";
import { eventsFor } from "../lib/events";
import { openWorkspaceDb } from "../lib/workspace/db";

const dir = mkdtempSync(join(tmpdir(), "ep-tenant-"));
process.env.CONTROL_DB_PATH = join(dir, "control.db");
process.env.WORKSPACE_DB_DIR = join(dir, "workspaces");
resetControlDbHandle();

describe("tenant isolation", () => {
  it("keeps events, goals, and command history out of the other workspace", () => {
    const a = AuthService.signup({ email: "tenant-a@example.com", password: "password1", name: "Ada" });
    const b = AuthService.signup({ email: "tenant-b@example.com", password: "password2", name: "Bea" });

    const dbA = openWorkspaceDb(a.workspace.id);
    const dbB = openWorkspaceDb(b.workspace.id);

    eventsFor(dbA).append({
      type: "message.received",
      source: "test",
      payload: { secret: "ADA-ONLY" },
    });
    dbA.prepare("INSERT INTO goals (id, name, target, payload) VALUES (?, ?, ?, ?)").run(
      "gol_ada",
      "Ada secret goal",
      "keep isolated",
      "{}",
    );

    const aEvents = eventsFor(dbA).list();
    const bEvents = eventsFor(dbB).list();
    assert.ok(aEvents.some((event) => JSON.stringify(event.payload).includes("ADA-ONLY")));
    assert.equal(
      bEvents.some((event) => JSON.stringify(event.payload).includes("ADA-ONLY")),
      false,
    );

    const bGoals = dbB.prepare("SELECT COUNT(*) as n FROM goals WHERE id = 'gol_ada'").get() as { n: number };
    assert.equal(bGoals.n, 0);

    assert.throws(() => assertWorkspaceAccess(b.user.id, a.workspace.id), ForbiddenError);
    assert.ok(assertWorkspaceAccess(a.user.id, a.workspace.id));
  });
});
