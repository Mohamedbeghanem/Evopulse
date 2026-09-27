import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getAgentRuntime } from "../lib/agent";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { EVENT_TYPES, eventsFor } from "../lib/events";
import { IDS } from "../lib/ids";
import { handleLearningEvent } from "../lib/learning";
import { replyMatchesTarget, verificationTargetFor } from "../lib/learning/verification";
import type { ActionRow } from "../lib/types";

// Salvaged from closed PR #17 (6d64086): a reply only verifies an action aimed at the party that replied.
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-reply-scope-")), "reply-scope.db");
delete process.env.OPENROUTER_API_KEY;
resetDbFile();

type Row = { exception_id: string; status: string };

function verificationsByException() {
  const rows = getDb().prepare("SELECT exception_id, status FROM verifications").all() as Row[];
  return Object.fromEntries(rows.map((row) => [row.exception_id, row.status]));
}

function exception(id: string) {
  return getDb().prepare("SELECT status, attention FROM exceptions WHERE id = ?").get(id) as {
    status: string;
    attention: string;
  };
}

function reply(sourceId: string, actorId: string, from: string) {
  const db = getDb();
  const now = getMeta(db, "demo_now");
  const event = eventsFor(db).append({
    type: EVENT_TYPES.CUSTOMER_REPLIED,
    source: "inbox",
    source_id: sourceId,
    actor_id: actorId,
    entity_type: "contact",
    entity_id: actorId,
    payload: { text: "Thanks, received.", from },
    occurred_at: now,
    received_at: now,
    confidence: 1,
    idempotent: true,
  });
  handleLearningEvent(db, event);
}

describe("verification reply scoping (salvaged from #17)", { concurrency: 1 }, () => {
  it("Protect everything → approve → two external drafts wait on two different parties", async () => {
    const db = getDb();
    triggerSupplierDelay(db);
    const runtime = getAgentRuntime(db);
    let run = await runtime.run({ command: "Protect everything at risk this week" });
    assert.equal(run.status, "waiting_for_approval");
    for (const approval of run.approvals.filter((item) => item.status === "pending")) {
      run = await runtime.resumeAfterApproval(run.id, { approvalId: approval.id, decision: "approve", actor: "operator" });
    }
    assert.deepEqual(verificationsByException(), {
      [IDS.excMissed]: "PENDING",
      [IDS.excDelay]: "PENDING",
    });
  });

  it("Amine's reply verifies the Amine follow-up only — the Oran Fresh notice stays unverified", () => {
    reply("test_reply_amine", IDS.contact, "Amine Khelifi");
    const statuses = verificationsByException();
    assert.equal(statuses[IDS.excMissed], "SUCCESS");
    assert.equal(statuses[IDS.excDelay], "PENDING", "another party's reply must not verify the supplier-delay notice");
    assert.notEqual(exception(IDS.excDelay).attention, "HANDLED");
    assert.equal(exception(IDS.excMissed).attention, "HANDLED");
  });

  it("Oran Fresh's own reply then verifies the supplier-delay notice", () => {
    reply("test_reply_oran", IDS.customerA, "Oran Fresh Market");
    assert.equal(verificationsByException()[IDS.excDelay], "SUCCESS");
    assert.equal(exception(IDS.excDelay).attention, "HANDLED");
  });

  it("resolves a short `to` name to its single business entity", () => {
    const action = { payload: JSON.stringify({ to: "Oran Fresh" }) } as ActionRow;
    assert.deepEqual(verificationTargetFor(getDb(), action), { entityId: IDS.customerA, name: "Oran Fresh" });
    const unnamed = { payload: JSON.stringify({ audience: "customer" }), exception_id: "" } as ActionRow;
    assert.equal(verificationTargetFor(getDb(), unnamed), null);
  });

  it("unscoped verifications keep accepting any reply; scoped ones require the target", () => {
    const unscoped = { metadata: JSON.stringify({ actionType: "draft_message" }) };
    assert.equal(replyMatchesTarget(unscoped, { actor_id: "anyone" }), true);
    const scoped = { metadata: JSON.stringify({ target: { entityId: IDS.customerA, name: "Oran Fresh" } }) };
    assert.equal(replyMatchesTarget(scoped, { actor_id: IDS.contact, payload: { from: "Amine Khelifi" } }), false);
    assert.equal(replyMatchesTarget(scoped, { actor_id: IDS.customerA }), true);
    assert.equal(replyMatchesTarget(scoped, { payload: { from: "oran fresh" } }), true);
  });
});
