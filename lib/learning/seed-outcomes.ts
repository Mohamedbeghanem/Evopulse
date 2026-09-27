import type { DatabaseSync } from "node:sqlite";
import { one } from "../db";
import { DEMO_NOW_ISO } from "../clock";
import { OutcomeLedger } from "./outcomes";
import { StrategyMemory } from "./strategy-memory";
import { SEED_FOLLOWUP_CONTEXT, SEED_FOLLOWUP_SIGNATURE } from "./context";
import { wipeLearningTables } from "./schema";

/**
 * Synthetic historical outcomes for the stale-opportunity / customer_no_response context.
 * Clearly marked. Counts must be derived from these rows — never hardcode UI percentages.
 *
 * Target derived counts:
 * - personalized_followup: 18 obs / 13 success
 * - call_first: 9 / 5
 * - generic_followup: 15 / 4
 */
export const SYNTHETIC_STRATEGY_TARGETS = {
  personalized_followup: { successes: 13, failures: 5 },
  call_first: { successes: 5, failures: 4 },
  generic_followup: { successes: 4, failures: 11 },
} as const;

const SYNTHETIC_NOTE = "synthetic historical observation — not a live Atlas case";

export function seedSyntheticLearningData(db: DatabaseSync, now = DEMO_NOW_ISO) {
  const existing = one<{ c: number }>(
    db,
    "SELECT COUNT(*) as c FROM outcomes WHERE id LIKE 'syn_out_%'",
  );
  if (existing && existing.c > 0) {
    StrategyMemory.for(db).refreshPatterns(SEED_FOLLOWUP_SIGNATURE, now);
    return;
  }

  const ledger = OutcomeLedger.for(db);
  let seq = 0;
  for (const [strategy, counts] of Object.entries(SYNTHETIC_STRATEGY_TARGETS)) {
    for (let i = 0; i < counts.successes; i += 1) {
      seq += 1;
      insertSynthetic(ledger, strategy, true, seq, now);
    }
    for (let i = 0; i < counts.failures; i += 1) {
      seq += 1;
      insertSynthetic(ledger, strategy, false, seq, now);
    }
  }

  StrategyMemory.for(db).refreshPatterns(SEED_FOLLOWUP_SIGNATURE, now);
}

export function reseedSyntheticLearningData(db: DatabaseSync, now = DEMO_NOW_ISO) {
  wipeLearningTables(db);
  seedSyntheticLearningData(db, now);
}

function insertSynthetic(
  ledger: OutcomeLedger,
  strategy: string,
  success: boolean,
  seq: number,
  now: string,
) {
  const pad = String(seq).padStart(2, "0");
  const hours = success ? 2 + (seq % 7) : 20 + (seq % 10);
  ledger.record({
    id: `syn_out_${strategy.slice(0, 2)}_${pad}`,
    problem_type: SEED_FOLLOWUP_CONTEXT.problem_type,
    context_signature: SEED_FOLLOWUP_SIGNATURE,
    exception_id: `syn_exc_${pad}`,
    plan_id: `syn_pln_${pad}`,
    action_id: `syn_act_${pad}`,
    verification_id: `syn_ver_${pad}`,
    strategy,
    result: success ? "customer_replied" : "no_response",
    success,
    time_to_result: hours * 3600,
    business_effect: SYNTHETIC_NOTE,
    policy_state: "historical_seed",
    human_feedback: null,
    created_at: offsetIso(now, -seq),
  });
}

function offsetIso(iso: string, dayDelta: number): string {
  const ms = Date.parse(iso);
  return new Date(ms + dayDelta * 24 * 60 * 60 * 1000).toISOString();
}
