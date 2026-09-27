import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { getPlanBundle } from "../lib/engine/recovery";
import { evaluatePolicy, loadPolicies } from "../lib/engine/policy";
import { IDS } from "../lib/ids";
import {
  HumanFeedbackService,
  LEARNING_THRESHOLDS,
  OutcomeLedger,
  patternStatusFromObservations,
  SEED_FOLLOWUP_SIGNATURE,
  StrategyMemory,
  SYNTHETIC_STRATEGY_TARGETS,
} from "../lib/learning";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-learn-")), "learning.db");
resetDbFile();

describe("StrategyMemory + seeded synthetic outcomes", { concurrency: 1 }, () => {
  it("derives seed rates from rows — never hardcoded percentages", () => {
    const db = getDb();
    const rows = OutcomeLedger.for(db).listByContext(SEED_FOLLOWUP_SIGNATURE);
    assert.ok(rows.every((r) => r.id.startsWith("syn_out_")));
    assert.ok(rows.every((r) => r.business_effect.includes("synthetic")));

    for (const [strategy, target] of Object.entries(SYNTHETIC_STRATEGY_TARGETS)) {
      const group = rows.filter((r) => r.strategy === strategy);
      const successes = group.filter((r) => Number(r.success) === 1).length;
      assert.equal(group.length, target.successes + target.failures, `${strategy} observation count`);
      assert.equal(successes, target.successes, `${strategy} success count`);
    }

    const memory = StrategyMemory.for(db).getStrategyEvidence(SEED_FOLLOWUP_SIGNATURE);
    const personalized = memory.strategies.find((s) => s.strategy === "personalized_followup");
    const callFirst = memory.strategies.find((s) => s.strategy === "call_first");
    const generic = memory.strategies.find((s) => s.strategy === "generic_followup");
    assert.ok(personalized && callFirst && generic);
    assert.equal(personalized.observations, 18);
    assert.equal(personalized.successes, 13);
    assert.equal(personalized.success_rate, Math.round((13 / 18) * 1000) / 1000);
    assert.equal(personalized.pattern_status, "RELIABLE_PATTERN");
    assert.equal(callFirst.observations, 9);
    assert.equal(callFirst.successes, 5);
    assert.equal(callFirst.pattern_status, "EMERGING_PATTERN");
    assert.equal(generic.observations, 15);
    assert.equal(generic.successes, 4);
    assert.equal(generic.pattern_status, "RELIABLE_PATTERN");
    assert.match(
      memory.historically_stronger_strategy?.wording || "",
      /Personalized follow-up has the strongest recorded outcome in 18 comparable synthetic cases/,
    );
    assert.doesNotMatch(memory.historically_stronger_strategy?.wording || "", /definitely|will work|best action/i);
    assert.match(personalized.evidence, /observed success rate across 18 recorded outcomes/);
  });

  it("classifies confidence from centralized thresholds", () => {
    assert.equal(patternStatusFromObservations(0), "OBSERVED");
    assert.equal(patternStatusFromObservations(1), "INSUFFICIENT_DATA");
    assert.equal(patternStatusFromObservations(LEARNING_THRESHOLDS.INSUFFICIENT_DATA_MAX), "INSUFFICIENT_DATA");
    assert.equal(patternStatusFromObservations(5), "EMERGING_PATTERN");
    assert.equal(patternStatusFromObservations(LEARNING_THRESHOLDS.EMERGING_PATTERN_MAX), "EMERGING_PATTERN");
    assert.equal(patternStatusFromObservations(LEARNING_THRESHOLDS.RELIABLE_PATTERN_MIN), "RELIABLE_PATTERN");
    assert.notEqual(patternStatusFromObservations(20), "APPROVED_AUTOMATION");
    assert.notEqual(patternStatusFromObservations(20), "CANDIDATE_AUTOMATION");
  });

  it("attaches historicalEvidence on a compatible recovery plan without overriding policy", () => {
    const db = getDb();
    const bundle = getPlanBundle(db, IDS.excMissed);
    assert.ok(bundle.historicalEvidence);
    assert.equal(bundle.historicalEvidence?.strategies.length, 3);
    const policies = loadPolicies(db);
    const blocked = evaluatePolicy({ type: "apply_discount", payload: { percent: 10 } }, policies);
    assert.equal(blocked.outcome, "BLOCKED");
    assert.match(blocked.reason, /discount_max=5/);
  });

  it("stores human corrections without changing aggregated strategy memory", () => {
    const db = getDb();
    const before = StrategyMemory.for(db).getStrategyEvidence(SEED_FOLLOWUP_SIGNATURE);
    const personalizedBefore = before.strategies.find((s) => s.strategy === "personalized_followup");
    HumanFeedbackService.for(db).record({
      action_id: IDS.actDraft,
      decision: "EDIT",
      original_strategy: "generic_followup",
      final_strategy: "personalized_followup",
      reason: "Need a named, specific follow-up",
      created_at: getMeta(db, "demo_now"),
    });
    const after = StrategyMemory.for(db).getStrategyEvidence(SEED_FOLLOWUP_SIGNATURE);
    const personalizedAfter = after.strategies.find((s) => s.strategy === "personalized_followup");
    assert.equal(personalizedAfter?.observations, personalizedBefore?.observations);
    const stats = HumanFeedbackService.for(db).getCorrectionStats("generic_followup");
    assert.equal(stats.edits, 1);
    assert.match(stats.wording || "", /Managers changed generic_followup in 1 of 1/);
  });
});
