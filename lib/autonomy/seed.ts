import type { DatabaseSync } from "node:sqlite";
import { DEMO_NOW_ISO } from "../clock";
import { audit, one, run } from "../db";
import { loadPolicies } from "../engine/policy";
import { OutcomeLedger } from "../learning/outcomes";
import { AUTONOMY_ACTIONS, policyCeiling } from "./ceilings";
import { autonomyHistorySignature, evidenceFor } from "./evidence";
import { meetsRequirements } from "./rules";
import { wipeAutonomyTables } from "./schema";
import { LEVEL_NAMES, type AutonomyLevel } from "./types";

/**
 * Synthetic autonomy history, one block of outcome rows per action type. Clearly marked synthetic.
 * Displayed counts are always re-derived from these rows (evidenceFor); nothing below is shown directly.
 * Failures are the oldest rows, so the recent window reflects the current record.
 *
 * `level` is the level humans granted before the demo starts. The seeder refuses any level the rows do not
 * support or the live policy ceiling does not allow, so the seed can never claim unearned authority.
 */
export const SEEDED_AUTONOMY: Record<string, { level: AutonomyLevel; successes: number; failures: number; abbr: string }> = {
  create_checkpoint: { level: 4, successes: 30, failures: 1, abbr: "ck" },
  create_task: { level: 4, successes: 39, failures: 1, abbr: "ct" },
  draft_message: { level: 3, successes: 20, failures: 2, abbr: "dm" },
  prepare_proposal: { level: 2, successes: 15, failures: 1, abbr: "pp" },
  send_message: { level: 2, successes: 11, failures: 1, abbr: "sm" },
  offer_alternative: { level: 1, successes: 2, failures: 1, abbr: "oa" },
  apply_discount: { level: 1, successes: 4, failures: 2, abbr: "ad" },
  delete_customer_data: { level: 0, successes: 0, failures: 0, abbr: "dc" },
};

const SYNTHETIC_NOTE = "synthetic historical observation — not a live Atlas case";
export const AUTONOMY_SYNTHETIC_PREFIX = "syn_aut_";

/**
 * Explicit demo seed. Called ONLY from lib/seed.ts (seedIfEmpty / wipeAndSeed), never lazily.
 * Profiles that already exist (for example lazily created at L0) are left untouched: seeding never raises them.
 */
export function seedAutonomy(db: DatabaseSync, now = DEMO_NOW_ISO) {
  seedAutonomyHistory(db, now);
  const policies = loadPolicies(db);

  for (const { type } of AUTONOMY_ACTIONS) {
    const exists = one<{ c: number }>(db, "SELECT COUNT(*) as c FROM autonomy_profiles WHERE action_type = ?", [type]);
    if (exists && exists.c > 0) continue;

    const spec = SEEDED_AUTONOMY[type];
    const requested = (spec?.level ?? 0) as AutonomyLevel;
    const e = evidenceFor(db, type);
    const ceiling = policyCeiling(type, policies);
    // Never seed unearned or out-of-policy authority: fall back to what the rows and policy support.
    let level = Math.min(requested, ceiling.level) as AutonomyLevel;
    while (level > 0 && !meetsRequirements(level, e).ok) level = (level - 1) as AutonomyLevel;

    const reason =
      e.verified > 0
        ? `Seeded at ${LEVEL_NAMES[level]} from ${e.verified} synthetic historical outcomes (${e.successes} successful).`
        : `Seeded at ${LEVEL_NAMES[level]}. No outcomes recorded.`;
    run(
      db,
      `INSERT INTO autonomy_profiles
        (action_type, level, suspended, suspended_reason, candidate_level, verified_outcomes, successes, failures,
         override_rate, evidence_mark, last_change_kind, last_change_by, last_change_reason, last_change_at,
         created_at, updated_at)
       VALUES (?, ?, 0, '', NULL, ?, ?, ?, ?, ?, 'seed_grant', 'seed', ?, ?, ?, ?)`,
      [type, level, e.verified, e.successes, e.failures, e.overrideRate, e.verified, reason, now, now, now],
    );
    run(
      db,
      `INSERT OR IGNORE INTO autonomy_changes (id, action_type, kind, from_level, to_level, actor, reason, evidence, created_at)
       VALUES (?, ?, 'seed_grant', NULL, ?, 'seed', ?, ?, ?)`,
      [
        `${AUTONOMY_SYNTHETIC_PREFIX}chg_${spec?.abbr ?? type}`,
        type,
        level,
        reason,
        JSON.stringify({ verified: e.verified, successes: e.successes, failures: e.failures, synthetic: e.synthetic }),
        now,
      ],
    );
    audit(db, "seed", "autonomy.seed_grant", "autonomy_profile", type, {
      from_level: null,
      to_level: level,
      reason,
      evidence: { verified: e.verified, successes: e.successes, failures: e.failures, synthetic: e.synthetic },
      at: now,
    });
  }

  // Candidates and stats are derived by the same review path the live system uses.
  const { reviewAll } = require("./service") as typeof import("./service");
  reviewAll(db, now);
}

/** Demo reset: drop profiles, changes, pause state and autonomy history; seed again. */
export function reseedAutonomy(db: DatabaseSync, now = DEMO_NOW_ISO) {
  wipeAutonomyTables(db);
  run(db, "DELETE FROM outcomes WHERE id LIKE ?", [`${AUTONOMY_SYNTHETIC_PREFIX}%`]);
  seedAutonomy(db, now);
}

function seedAutonomyHistory(db: DatabaseSync, now: string) {
  const existing = one<{ c: number }>(db, "SELECT COUNT(*) as c FROM outcomes WHERE id LIKE ?", [
    `${AUTONOMY_SYNTHETIC_PREFIX}%`,
  ]);
  if (existing && existing.c > 0) return;

  const ledger = OutcomeLedger.for(db);
  for (const [type, spec] of Object.entries(SEEDED_AUTONOMY)) {
    const total = spec.successes + spec.failures;
    // i = 0 is the newest row. The last `failures` rows (oldest) are the failures.
    for (let i = 0; i < total; i += 1) {
      const success = i < spec.successes;
      const pad = String(i + 1).padStart(2, "0");
      ledger.record({
        id: `${AUTONOMY_SYNTHETIC_PREFIX}${spec.abbr}_${pad}`,
        problem_type: "autonomy_history",
        context_signature: autonomyHistorySignature(type),
        exception_id: null,
        plan_id: null,
        action_id: `${AUTONOMY_SYNTHETIC_PREFIX}act_${spec.abbr}_${pad}`,
        verification_id: `${AUTONOMY_SYNTHETIC_PREFIX}ver_${spec.abbr}_${pad}`,
        strategy: type,
        result: success ? "verified_success" : "verified_failure",
        success,
        time_to_result: 3600,
        business_effect: SYNTHETIC_NOTE,
        policy_state: "historical_seed",
        human_feedback: null,
        created_at: new Date(Date.parse(now) - (i + 1) * 12 * 3600 * 1000).toISOString(),
      });
    }
  }
}
