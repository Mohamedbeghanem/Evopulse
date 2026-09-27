import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getAgentRuntime } from "../lib/agent";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { detectExceptions } from "../lib/engine/pulse";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { IDS } from "../lib/ids";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-no-reraise-")), "no-reraise.db");
delete process.env.OPENROUTER_API_KEY;
resetDbFile();

describe("Detect does not re-raise a resolved 320K situation", { concurrency: 1 }, () => {
  it("Protect everything → approve all → 10% message does not crash and stays BLOCKED", async () => {
    const db = getDb();
    triggerSupplierDelay(db);
    const runtime = getAgentRuntime(db);
    let run = await runtime.run({ command: "Protect everything at risk this week" });
    for (const approval of run.approvals.filter((item) => item.status === "pending")) {
      run = await runtime.resumeAfterApproval(run.id, { approvalId: approval.id, decision: "approve", actor: "operator" });
    }

    // Before the fix this threw "UNIQUE constraint failed: exceptions.id" (POST /api/demo/discount → 500).
    await ingestSeedDiscount(db);

    const blocked = db.prepare("SELECT policy_outcome, status FROM actions WHERE id = ?").get(IDS.actDiscount) as {
      policy_outcome: string;
      status: string;
    };
    assert.equal(blocked.policy_outcome, "BLOCKED");
    assert.notEqual(blocked.status, "executed");
    const policy = db.prepare("SELECT value FROM policies WHERE key = 'discount_max'").get() as { value: string };
    assert.equal(Number(policy.value), 5);
  });

  it("one 320K situation: a later clock sweep does not duplicate it", () => {
    const db = getDb();
    const count = () =>
      (db.prepare("SELECT COUNT(*) AS c FROM exceptions WHERE expectation_id = ?").get(IDS.expectOurs) as { c: number }).c;
    const before = count();
    detectExceptions(db, getMeta(db, "demo_now"));
    detectExceptions(db, getMeta(db, "demo_now"));
    assert.equal(count(), before);
    assert.equal(before, 1);
  });
});
