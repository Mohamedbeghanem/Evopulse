import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { executePlan } from "../lib/engine/execute";
import { IDS } from "../lib/ids";
import { addHours, OutcomeLedger, VerificationService } from "../lib/learning";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-ver-")), "learning.db");
resetDbFile();

describe("VerificationService", { concurrency: 1 }, () => {
  it("creates a pending verification after execute and does not treat send as success", () => {
    const db = getDb();
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    const pending = VerificationService.for(db).getPendingVerifications(IDS.excMissed);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].status, "PENDING");
    const exception = db.prepare("SELECT status, attention FROM exceptions WHERE id = ?").get(IDS.excMissed) as {
      status: string;
      attention: string;
    };
    assert.equal(exception.status, "awaiting_verification");
    assert.equal(exception.attention, "MONITORING");
    assert.notEqual(exception.status, "resolved");
  });

  it("resolves SUCCESS when customer.response arrives before the deadline", () => {
    const db = getDb();
    const service = VerificationService.for(db);
    const pending = service.getPendingVerifications(IDS.excMissed)[0];
    assert.ok(pending);
    const resolved = service.evaluateVerification(pending.id, {
      type: "customer.replied",
      occurred_at: getMeta(db, "demo_now"),
      id: "evt_test_reply",
    });
    assert.equal(resolved.status, "SUCCESS");
    assert.ok(resolved.resolved_at);
    const again = service.evaluateVerification(pending.id, {
      type: "customer.replied",
      occurred_at: getMeta(db, "demo_now"),
    });
    assert.equal(again.status, "SUCCESS");
  });

  it("fails expired verifications deterministically — LLM does not own the deadline", () => {
    const db = getDb();
    const service = VerificationService.for(db);
    const created = service.createVerification({
      action_id: IDS.actDraft,
      exception_id: "exc_expire_demo",
      now: "2026-09-27T08:00:00.000Z",
      expected_by: "2026-09-27T09:00:00.000Z",
    });
    assert.equal(created.status, "PENDING");
    const failed = service.failExpiredVerifications("2026-09-27T09:00:00.000Z");
    assert.ok(failed.some((v) => v.id === created.id && v.status === "FAILED"));
    const outcome = OutcomeLedger.for(db).recordFromVerification(service.getById(created.id)!, "2026-09-27T09:00:00.000Z");
    assert.ok(outcome);
    assert.equal(outcome.success, 0);
    assert.equal(outcome.result, "no_response");
  });

  it("cancels a pending verification without recording success", () => {
    const db = getDb();
    const service = VerificationService.for(db);
    const created = service.createVerification({
      action_id: IDS.actCheck,
      exception_id: "exc_cancel_demo",
      now: getMeta(db, "demo_now"),
      expected_by: addHours(getMeta(db, "demo_now"), 24),
    });
    const cancelled = service.resolveVerification(created.id, "CANCELLED", getMeta(db, "demo_now"), {
      reason: "Operator cancelled",
    });
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(OutcomeLedger.for(db).recordFromVerification(cancelled, getMeta(db, "demo_now")), null);
  });
});
