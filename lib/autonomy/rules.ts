import { LEARNING_THRESHOLDS } from "../learning/confidence";
import type { AutonomyEvidence, AutonomyLevel } from "./types";

/**
 * Evidence thresholds. Sample sizes come from the learning-confidence thresholds (lib/learning/confidence.ts)
 * so "reliable" means the same thing everywhere. Meeting these makes an action a promotion CANDIDATE only.
 * A human approval applies a promotion.
 */
export const PROMOTION_REQUIREMENTS: Record<
  Exclude<AutonomyLevel, 0>,
  { minVerified: number; minSuccessRate: number; maxOverrideRate: number }
> = {
  1: { minVerified: 0, minSuccessRate: 0, maxOverrideRate: 1 },
  /** EMERGING_PATTERN: more than INSUFFICIENT_DATA_MAX verified outcomes. */
  2: { minVerified: LEARNING_THRESHOLDS.INSUFFICIENT_DATA_MAX + 1, minSuccessRate: 0.7, maxOverrideRate: 0.3 },
  /** RELIABLE_PATTERN. */
  3: { minVerified: LEARNING_THRESHOLDS.RELIABLE_PATTERN_MIN, minSuccessRate: 0.85, maxOverrideRate: 0.2 },
  /** Twice the reliable sample, near-perfect record, rare human overrides. */
  4: { minVerified: LEARNING_THRESHOLDS.RELIABLE_PATTERN_MIN * 2, minSuccessRate: 0.95, maxOverrideRate: 0.1 },
};

/** Demotion looks at the most recent outcomes, so an old record cannot hide current failures. */
export const RECENT_WINDOW = 20;
/** Never demote on a rate from fewer than this many recent outcomes (EMERGING_PATTERN minimum). */
export const DEMOTION_MIN_SAMPLE = LEARNING_THRESHOLDS.INSUFFICIENT_DATA_MAX + 1;
/** Consecutive most-recent failures that demote one level regardless of rate. */
export const FAILURE_STREAK_DEMOTION = 3;
/** Recent success rate below the floor for the current level demotes one level. Hysteresis below promotion. */
export const DEMOTION_FLOORS: Record<AutonomyLevel, number> = { 0: 0, 1: 0, 2: 0.6, 3: 0.75, 4: 0.85 };

/** Outcome results that suspend an action type immediately. */
export const SEVERE_RESULTS = new Set(["severe_failure", "customer_harm", "policy_violation"]);

/**
 * Identities that may never approve promotion, reinstate, or resume: engines and default/placeholder names.
 * Compared case-insensitively after trimming. There is no auth yet, so this is a deny-list of known non-humans,
 * not an allow-list of real people.
 */
export const NON_HUMAN_ACTORS = new Set([
  "",
  "operator",
  "evopulse",
  "system",
  "seed",
  "autopilot",
  "autonomy-engine",
  "pulse-engine",
  "impact-engine",
  "ai",
  "bot",
  "llm",
  "planner",
  "unknown",
]);

export function isHumanActor(actor: string | undefined | null): boolean {
  const a = (actor || "").trim().toLowerCase();
  return !NON_HUMAN_ACTORS.has(a) && !a.startsWith("engine:") && !a.startsWith("ai:");
}

export function meetsRequirements(level: AutonomyLevel, e: AutonomyEvidence): { ok: boolean; why: string } {
  if (level === 0) return { ok: true, why: "Observe needs no evidence." };
  const req = PROMOTION_REQUIREMENTS[level];
  if (e.verified < req.minVerified) {
    return { ok: false, why: `needs ${req.minVerified} verified outcomes, has ${e.verified}` };
  }
  if (e.verified > 0 && e.successRate < req.minSuccessRate) {
    return {
      ok: false,
      why: `needs ${pct(req.minSuccessRate)} success, has ${pct(e.successRate)}`,
    };
  }
  if (e.recentVerified >= DEMOTION_MIN_SAMPLE && e.recentSuccessRate < req.minSuccessRate) {
    return {
      ok: false,
      why: `recent success ${pct(e.recentSuccessRate)} is below the ${pct(req.minSuccessRate)} needed`,
    };
  }
  if (e.overrideRate > req.maxOverrideRate) {
    return {
      ok: false,
      why: `human override rate ${pct(e.overrideRate)} is above ${pct(req.maxOverrideRate)}`,
    };
  }
  if (e.failureStreak >= FAILURE_STREAK_DEMOTION) {
    return { ok: false, why: `${e.failureStreak} consecutive recent failures` };
  }
  return {
    ok: true,
    why: `${e.verified} verified outcomes, ${pct(e.successRate)} success, ${pct(e.overrideRate)} overrides`,
  };
}

/** Why the current level should drop, or null. Pure; callers decide whether the evidence is new. */
export function demotionTrigger(level: AutonomyLevel, e: AutonomyEvidence): string | null {
  if (level === 0) return null;
  if (e.failureStreak >= FAILURE_STREAK_DEMOTION) {
    return `${e.failureStreak} consecutive failed outcomes`;
  }
  const floor = DEMOTION_FLOORS[level];
  if (floor > 0 && e.recentVerified >= DEMOTION_MIN_SAMPLE && e.recentSuccessRate < floor) {
    return `recent success rate ${pct(e.recentSuccessRate)} over ${e.recentVerified} outcomes is below the ${pct(floor)} floor for this level`;
  }
  return null;
}

export function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
