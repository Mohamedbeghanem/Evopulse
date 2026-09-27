import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, getMeta } from "../lib/db";
import { executePlan } from "../lib/engine/execute";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { pulseSummary } from "../lib/engine/pulse";
import { EVENT_TYPES, eventsFor } from "../lib/events";
import { IDS } from "../lib/ids";
import { exceptionDetail } from "../lib/read";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-")), "loop.db");

describe("seeded 320K loop", () => {
  it("cold start → recover → 10% BLOCKED with alternative", async () => {
    const db = getDb();
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    assert.match(pulse.headline, /320/);
    assert.ok(pulse.counts.NEEDS_YOU >= 1);
    const seedTypes = new Set(eventsFor(db).list().map((e) => e.type));
    assert.ok(seedTypes.has(EVENT_TYPES.MESSAGE_RECEIVED));
    assert.ok(seedTypes.has(EVENT_TYPES.COMMITMENT_CREATED));
    assert.ok(seedTypes.has(EVENT_TYPES.COMMITMENT_MISSED));
    assert.ok(seedTypes.has(EVENT_TYPES.DEAL_CREATED));

    const miss = pulse.exceptions.find((e) => e.id === IDS.excMissed);
    assert.ok(miss);
    assert.equal(miss?.attention, "NEEDS_YOU");
    assert.equal(miss?.impact.revenueAssociated, 320000);
    assert.match(miss?.evidence.quote || "", /revised 320,000 DZD proposal/);

    const before = exceptionDetail(db, IDS.excMissed);
    assert.ok(before?.plan);
    assert.equal(before?.plan?.status, "approval_required");
    const draft = before?.actions.find((a) => a.type === "draft_message");
    assert.equal(draft?.policy_outcome, "APPROVAL_REQUIRED");

    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    const after = exceptionDetail(db, IDS.excMissed);
    assert.equal(after?.exception.attention, "HANDLED");
    assert.equal(after?.exception.status, "resolved");
    assert.equal(getMeta(db, "demo_phase"), "recovered");
    const pulseAfter = pulseSummary(db, getMeta(db, "demo_now"));
    assert.equal(pulseAfter.counts.NEEDS_YOU, 0);
    assert.equal(pulseAfter.counts.HANDLED, 1);
    const recoveredTypes = new Set(eventsFor(db).list().map((e) => e.type));
    assert.ok(recoveredTypes.has(EVENT_TYPES.ACTION_EXECUTED));
    assert.ok(recoveredTypes.has(EVENT_TYPES.QUOTE_SENT));
    assert.ok(recoveredTypes.has(EVENT_TYPES.COMMITMENT_FULFILLED));

    await ingestSeedDiscount(db);
    const detail = exceptionDetail(db, IDS.excDiscount);
    assert.ok(detail);
    assert.equal(detail?.exception.attention, "NEEDS_YOU");
    const blocked = detail?.actions.find((a) => a.id === IDS.actDiscount);
    assert.equal(blocked?.policy_outcome, "BLOCKED");
    const alt = detail?.actions.find((a) => a.id === IDS.actAlt5);
    assert.ok(alt);
    assert.notEqual(alt?.policy_outcome, "BLOCKED");
    assert.equal(getMeta(db, "demo_phase"), "discount_blocked");
    const blockedTypes = new Set(eventsFor(db).list().map((e) => e.type));
    assert.ok(blockedTypes.has(EVENT_TYPES.POLICY_BLOCKED));
    assert.ok(blockedTypes.has(EVENT_TYPES.CUSTOMER_REPLIED));
  });
});
