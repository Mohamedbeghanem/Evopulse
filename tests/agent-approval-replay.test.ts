import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DeterministicRuntime } from "../lib/agent";
import { getDb, resetDbFile } from "../lib/db";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { POST as approveRoute } from "../app/api/agent/runs/[id]/approve/route";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-agent-replay-")), "agent.db");
delete process.env.OPENAI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.DEEPSEEK_API_KEY;
process.env.EVOPULSE_AGENT_RUNTIME = "deterministic";
resetDbFile();

describe("agent approval replay", { concurrency: 1 }, () => {
  it("a rejected approval cannot later be approved, and its action never runs", async () => {
    const db = getDb();
    triggerSupplierDelay(db);
    const agent = new DeterministicRuntime(db);
    const started = await agent.run({ command: "Protect everything at risk this week." });
    assert.ok(started.approvals.length > 0, "scenario must produce an approval to test");
    const approval = started.approvals[0];
    const statusOf = () =>
      (db.prepare("SELECT status FROM actions WHERE id = ?").get(approval.actionId) as { status: string } | undefined)
        ?.status;
    const before = statusOf();

    const rejected = await agent.resumeAfterApproval(started.id, { approvalId: approval.id, decision: "reject" });
    assert.equal(rejected.approvals.find((item) => item.id === approval.id)?.status, "rejected");

    await assert.rejects(
      async () => agent.resumeAfterApproval(started.id, { approvalId: approval.id, decision: "approve" }),
      /no longer pending/,
    );
    await assert.rejects(
      async () => agent.resumeAfterApproval(started.id, { actionId: approval.actionId, decision: "approve" }),
      /no longer pending/,
    );
    const res = await approveRoute(
      new Request("http://local/api", { method: "POST", body: JSON.stringify({ approvalId: approval.id }) }),
      { params: Promise.resolve({ id: started.id }) },
    );
    assert.equal(res.status, 409);
    assert.equal(statusOf(), before);
    assert.notEqual(statusOf(), "executed");
    const after = db.prepare("SELECT status FROM agent_approvals WHERE id = ?").get(approval.id) as { status: string };
    assert.equal(after.status, "rejected");
  });

  it("an unknown approvalId or actionId is refused, never resolved to another pending approval", async () => {
    const db = getDb();
    const agent = new DeterministicRuntime(db);
    const started = await agent.run({ command: "Protect everything at risk this week." });
    const pending = started.approvals.filter((item) => item.status === "pending");
    assert.ok(pending.length >= 2, "scenario must produce at least two pending approvals");
    const statuses = () =>
      pending.map(
        (item) => (db.prepare("SELECT status FROM actions WHERE id = ?").get(item.actionId) as { status: string }).status,
      );
    const actionsBefore = statuses();
    const approvalsBefore = pending.map(
      (item) => (db.prepare("SELECT status FROM agent_approvals WHERE id = ?").get(item.id) as { status: string }).status,
    );

    await assert.rejects(
      async () => agent.resumeAfterApproval(started.id, { approvalId: "apr_does_not_exist", decision: "approve" }),
      /Approval not found/,
    );
    await assert.rejects(
      async () => agent.resumeAfterApproval(started.id, { actionId: "act_does_not_exist", decision: "approve" }),
      /Approval not found/,
    );
    const res = await approveRoute(
      new Request("http://local/api", { method: "POST", body: JSON.stringify({ approvalId: "apr_does_not_exist" }) }),
      { params: Promise.resolve({ id: started.id }) },
    );
    assert.equal(res.status, 404);

    assert.deepEqual(statuses(), actionsBefore);
    assert.deepEqual(
      pending.map(
        (item) => (db.prepare("SELECT status FROM agent_approvals WHERE id = ?").get(item.id) as { status: string }).status,
      ),
      approvalsBefore,
    );
  });
});
