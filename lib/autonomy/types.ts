import type { PolicyOutcome } from "../types";

/**
 * Adaptive Autonomy (PLAN.md §23). Autonomy is earned per action type, never globally.
 *
 *   0 OBSERVE               — EvoPulse watches and reports. It proposes nothing for this action.
 *   1 RECOMMEND             — EvoPulse suggests the action. A human performs it.
 *   2 PREPARE               — EvoPulse prepares the action ready to run. A human approves each run.
 *   3 EXECUTE_SAFE          — EvoPulse runs reversible, internal instances that policy marks AUTO.
 *   4 OPERATE_WITHIN_POLICY — EvoPulse runs any instance that policy marks AUTO.
 *
 * Deterministic software owns every level. An LLM never assigns or changes one.
 */
export const AUTONOMY_LEVELS = [0, 1, 2, 3, 4] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const LEVEL_KEYS: Record<AutonomyLevel, string> = {
  0: "OBSERVE",
  1: "RECOMMEND",
  2: "PREPARE",
  3: "EXECUTE_SAFE",
  4: "OPERATE_WITHIN_POLICY",
};

export const LEVEL_NAMES: Record<AutonomyLevel, string> = {
  0: "Observe",
  1: "Recommend",
  2: "Prepare",
  3: "Execute Safe",
  4: "Operate Within Policy",
};

export const LEVEL_DESCRIPTIONS: Record<AutonomyLevel, string> = {
  0: "Watches and reports. Proposes nothing.",
  1: "Suggests the action. A human performs it.",
  2: "Prepares the action ready to run. A human approves each run.",
  3: "Runs reversible, internal steps that policy allows. Everything else waits for approval.",
  4: "Runs any step that policy allows without per-step approval.",
};

export const CHANGE_KINDS = [
  "seed_grant",
  "promotion_candidate",
  "promotion",
  "promotion_refused",
  "demotion",
  "suspension",
  "reinstatement",
  "emergency_pause",
  "emergency_resume",
] as const;
export type AutonomyChangeKind = (typeof CHANGE_KINDS)[number];

export type CeilingKind = "none" | "policy" | "financial" | "prohibited";

export type PolicyCeiling = {
  level: AutonomyLevel;
  kind: CeilingKind;
  /** Short label for the UI: "Policy ceiling", "Financial control", "Autonomy prohibited". */
  label: string;
  /** Policy engine outcome for the canonical instance of this action type. */
  policyOutcome: PolicyOutcome;
  /** Policy engine reason, verbatim. */
  policyReason: string;
};

export type AutonomyEvidence = {
  verified: number;
  successes: number;
  failures: number;
  successRate: number;
  /** Most recent RECENT_WINDOW outcomes. */
  recentVerified: number;
  recentSuccessRate: number;
  /** Consecutive failures counted from the most recent outcome backwards. */
  failureStreak: number;
  feedbackTotal: number;
  overrides: number;
  overrideRate: number;
  /** Synthetic seeded rows inside `verified`. */
  synthetic: number;
  /** Outcome rows ordered newest first. */
  outcomeIds: string[];
  severeOutcomeIds: string[];
};

export type AutonomyProfileRow = {
  action_type: string;
  level: number;
  suspended: number;
  suspended_reason: string;
  candidate_level: number | null;
  verified_outcomes: number;
  successes: number;
  failures: number;
  override_rate: number;
  evidence_mark: number;
  last_change_kind: string;
  last_change_by: string;
  last_change_reason: string;
  last_change_at: string;
  created_at: string;
  updated_at: string;
};

export type AutonomyChangeRow = {
  id: string;
  action_type: string;
  kind: AutonomyChangeKind;
  from_level: number | null;
  to_level: number | null;
  actor: string;
  reason: string;
  evidence: string;
  created_at: string;
};

export type AutonomyProfile = {
  actionType: string;
  label: string;
  level: AutonomyLevel;
  levelName: string;
  effectiveLevel: AutonomyLevel;
  effectiveLevelName: string;
  ceiling: PolicyCeiling;
  suspended: boolean;
  suspendedReason: string;
  paused: boolean;
  candidateLevel: AutonomyLevel | null;
  evidence: AutonomyEvidence;
  /** "31 verified outcomes · 30 successful" */
  evidenceText: string;
  /** Why the effective level is what it is: ceiling label, suspension, pause, or evidence. */
  limitReason: string;
  lastChange: { kind: string; by: string; reason: string; at: string };
};

export type AutonomyMode = "observe" | "recommend" | "prepare" | "auto" | "blocked";

/**
 * THE autopilot integration seam. Plain data, safe to log into a decision row.
 * `mayAutoExecute` true is the only way autonomy lets anything run without a human.
 */
export type AutonomyGateResult = {
  actionType: string;
  level: AutonomyLevel;
  levelName: string;
  ceiling: AutonomyLevel;
  mode: AutonomyMode;
  mayAutoExecute: boolean;
  requiresApproval: boolean;
  blocked: boolean;
  policyOutcome: PolicyOutcome;
  /** Same vocabulary as the autopilot's per-action ActionGate (lib/autopilot/types.ts). */
  actionGate: "AUTO" | "NEEDS_APPROVAL" | "BLOCKED";
  reason: string;
};

export type EmergencyPauseState = {
  paused: boolean;
  by: string;
  reason: string;
  at: string;
};
