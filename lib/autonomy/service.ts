import type { DatabaseSync } from "node:sqlite";
import { all, audit, getMeta, one, run, setMeta } from "../db";
import { loadPolicies } from "../engine/policy";
import { registerEngineHook, eventsFor, type BusinessEvent } from "../events";
import { id } from "../ids";
import { LEARNING_EVENT_TYPES } from "../learning/verification";
import type { PolicyOutcome } from "../types";
import { actionLabel, CUSTOMER_FACING_TYPES, instancePolicy, policyCeiling, REVERSIBLE_INTERNAL_TYPES } from "./ceilings";
import { evidenceFor, evidenceText } from "./evidence";
import { demotionTrigger, isHumanActor, meetsRequirements } from "./rules";
import { AUTONOMY_PAUSE_META_KEY } from "./schema";
import {
  LEVEL_NAMES,
  type AutonomyChangeKind,
  type AutonomyChangeRow,
  type AutonomyEvidence,
  type AutonomyGateResult,
  type AutonomyLevel,
  type AutonomyMode,
  type AutonomyProfile,
  type AutonomyProfileRow,
  type EmergencyPauseState,
} from "./types";

export const ENGINE_ACTOR = "autonomy-engine";
/** Pseudo action type for global changes (emergency pause / resume). */
export const GLOBAL_SCOPE = "*";

export class AutonomyError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

type ChangeOpts = { actor?: string; reason?: string; now?: string };

const nowIso = (now?: string) => now || new Date().toISOString();
const asLevel = (n: number): AutonomyLevel => Math.max(0, Math.min(4, Math.trunc(n))) as AutonomyLevel;

function evidenceSummary(e: AutonomyEvidence) {
  return {
    verified: e.verified,
    successes: e.successes,
    failures: e.failures,
    success_rate: e.successRate,
    recent_success_rate: e.recentSuccessRate,
    failure_streak: e.failureStreak,
    override_rate: e.overrideRate,
    feedback: e.feedbackTotal,
    synthetic: e.synthetic,
  };
}

/** Every autonomy change lands in three places: autonomy_changes, audit_logs, and the event stream. */
function recordChange(
  db: DatabaseSync,
  input: {
    actionType: string;
    kind: AutonomyChangeKind;
    from: number | null;
    to: number | null;
    actor: string;
    reason: string;
    evidence: Record<string, unknown>;
    now: string;
    emitEvent?: boolean;
  },
): AutonomyChangeRow {
  const row: AutonomyChangeRow = {
    id: id("atc"),
    action_type: input.actionType,
    kind: input.kind,
    from_level: input.from,
    to_level: input.to,
    actor: input.actor,
    reason: input.reason,
    evidence: JSON.stringify(input.evidence),
    created_at: input.now,
  };
  run(
    db,
    `INSERT INTO autonomy_changes (id, action_type, kind, from_level, to_level, actor, reason, evidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.action_type, row.kind, row.from_level, row.to_level, row.actor, row.reason, row.evidence, row.created_at],
  );
  audit(db, input.actor, `autonomy.${input.kind}`, "autonomy_profile", input.actionType, {
    changeId: row.id,
    from_level: input.from,
    to_level: input.to,
    reason: input.reason,
    evidence: input.evidence,
    at: input.now,
  });
  if (input.emitEvent !== false) {
    eventsFor(db).append({
      type: `autonomy.${input.kind}`,
      source: "autonomy-engine",
      source_id: row.id,
      actor_id: input.actor,
      entity_type: "autonomy_profile",
      entity_id: input.actionType,
      payload: { from_level: input.from, to_level: input.to, reason: input.reason, evidence: input.evidence },
      occurred_at: input.now,
      received_at: input.now,
      confidence: 1,
      idempotent: true,
    });
  }
  return row;
}

function markChange(db: DatabaseSync, type: string, kind: AutonomyChangeKind, actor: string, reason: string, now: string) {
  run(
    db,
    `UPDATE autonomy_profiles
        SET last_change_kind = ?, last_change_by = ?, last_change_reason = ?, last_change_at = ?, updated_at = ?
      WHERE action_type = ?`,
    [kind, actor, reason, now, now, type],
  );
}

function getRow(db: DatabaseSync, type: string) {
  return one<AutonomyProfileRow>(db, "SELECT * FROM autonomy_profiles WHERE action_type = ?", [type]);
}

// ─── Emergency pause ────────────────────────────────────────────────────────

export function getPauseState(db: DatabaseSync): EmergencyPauseState {
  const raw = getMeta(db, AUTONOMY_PAUSE_META_KEY, "");
  if (!raw) return { paused: false, by: "", reason: "", at: "" };
  try {
    const parsed = JSON.parse(raw) as Partial<EmergencyPauseState>;
    return { paused: Boolean(parsed.paused), by: parsed.by || "", reason: parsed.reason || "", at: parsed.at || "" };
  } catch {
    // Unreadable state fails safe: paused.
    return { paused: true, by: "unknown", reason: "Unreadable pause state — failing safe.", at: "" };
  }
}

/** One global switch. Every action drops to Observe immediately. Anyone (human or engine) may pull it. */
export function emergencyPause(db: DatabaseSync, opts: ChangeOpts = {}): EmergencyPauseState {
  const now = nowIso(opts.now);
  const actor = opts.actor || "operator";
  const current = getPauseState(db);
  if (current.paused) return current;
  const reason = opts.reason || "Emergency pause.";
  const state: EmergencyPauseState = { paused: true, by: actor, reason, at: now };
  setMeta(db, AUTONOMY_PAUSE_META_KEY, JSON.stringify(state));
  recordChange(db, {
    actionType: GLOBAL_SCOPE,
    kind: "emergency_pause",
    from: null,
    to: 0,
    actor,
    reason,
    evidence: { profiles: countProfiles(db) },
    now,
  });
  return state;
}

/** Resuming restores earned levels. A human must do it. */
export function emergencyResume(db: DatabaseSync, opts: ChangeOpts = {}): EmergencyPauseState {
  const now = nowIso(opts.now);
  const actor = opts.actor || "";
  if (!isHumanActor(actor)) throw new AutonomyError("Resuming autonomy requires a named human.", 403);
  const current = getPauseState(db);
  if (!current.paused) return current;
  const reason = opts.reason || "Emergency pause lifted.";
  const state: EmergencyPauseState = { paused: false, by: actor, reason, at: now };
  setMeta(db, AUTONOMY_PAUSE_META_KEY, JSON.stringify(state));
  recordChange(db, {
    actionType: GLOBAL_SCOPE,
    kind: "emergency_resume",
    from: 0,
    to: null,
    actor,
    reason,
    evidence: { paused_since: current.at, paused_by: current.by },
    now,
  });
  return state;
}

function countProfiles(db: DatabaseSync) {
  return one<{ c: number }>(db, "SELECT COUNT(*) as c FROM autonomy_profiles")?.c ?? 0;
}

// ─── Review: stats, automatic demotion / suspension, promotion candidates ──

/**
 * Re-reads evidence and applies the automatic rules. Only authority REDUCTIONS are automatic.
 * Evidence can raise at most `candidate_level`; the level itself only rises through `approvePromotion`.
 */
export function reviewProfile(db: DatabaseSync, type: string, now?: string): AutonomyProfileRow | undefined {
  const at = nowIso(now);
  let row = getRow(db, type);
  if (!row) return undefined;
  const e = evidenceFor(db, type);
  const ceiling = policyCeiling(type, loadPolicies(db));

  const fresh = e.verified - row.evidence_mark;
  if (!row.suspended && fresh > 0) {
    const newest = new Set(e.outcomeIds.slice(0, fresh));
    const severe = e.severeOutcomeIds.filter((oid) => newest.has(oid));
    if (severe.length) {
      suspendInternal(db, row, {
        actor: ENGINE_ACTOR,
        reason: `Severe failure recorded (${severe.join(", ")}). Suspended until a human reinstates.`,
        now: at,
        evidence: { ...evidenceSummary(e), severe_outcomes: severe },
      });
    } else {
      const trigger = demotionTrigger(asLevel(row.level), e);
      if (trigger) {
        const from = row.level;
        const to = from - 1;
        run(db, "UPDATE autonomy_profiles SET level = ?, evidence_mark = ? WHERE action_type = ?", [to, e.verified, type]);
        const reason = `Automatic demotion: ${trigger}.`;
        recordChange(db, { actionType: type, kind: "demotion", from, to, actor: ENGINE_ACTOR, reason, evidence: evidenceSummary(e), now: at });
        markChange(db, type, "demotion", ENGINE_ACTOR, reason, at);
      }
    }
    row = getRow(db, type)!;
  }

  const level = asLevel(row.level);
  let candidate: AutonomyLevel | null = null;
  if (!row.suspended && level < 4) {
    const next = asLevel(level + 1);
    if (next <= ceiling.level && meetsRequirements(next, e).ok) candidate = next;
  }
  if (candidate !== (row.candidate_level ?? null)) {
    run(db, "UPDATE autonomy_profiles SET candidate_level = ? WHERE action_type = ?", [candidate, type]);
    if (candidate !== null) {
      recordChange(db, {
        actionType: type,
        kind: "promotion_candidate",
        from: level,
        to: candidate,
        actor: ENGINE_ACTOR,
        reason: `Evidence supports ${LEVEL_NAMES[candidate]}: ${meetsRequirements(candidate, e).why}. Awaiting human approval — level unchanged.`,
        evidence: evidenceSummary(e),
        now: at,
      });
    }
  }

  run(
    db,
    `UPDATE autonomy_profiles
        SET verified_outcomes = ?, successes = ?, failures = ?, override_rate = ?
      WHERE action_type = ?`,
    [e.verified, e.successes, e.failures, e.overrideRate, type],
  );
  return getRow(db, type);
}

export function reviewAll(db: DatabaseSync, now?: string) {
  for (const r of all<{ action_type: string }>(db, "SELECT action_type FROM autonomy_profiles ORDER BY action_type")) {
    reviewProfile(db, r.action_type, now);
  }
}

// ─── Read model ─────────────────────────────────────────────────────────────

function toProfile(db: DatabaseSync, row: AutonomyProfileRow, pause: EmergencyPauseState, policies: Record<string, string>): AutonomyProfile {
  const e = evidenceFor(db, row.action_type);
  const ceiling = policyCeiling(row.action_type, policies);
  const level = asLevel(row.level);
  const suspended = Boolean(row.suspended);
  const effective: AutonomyLevel = pause.paused || suspended ? 0 : (Math.min(level, ceiling.level) as AutonomyLevel);
  let limitReason: string;
  if (pause.paused) limitReason = "Emergency pause";
  else if (suspended) limitReason = "Suspended";
  // Policy is the headline when it withholds autonomous execution entirely (cap below Execute Safe).
  // At execution levels the earned evidence is the headline; the ceiling is still shown alongside.
  else if (ceiling.level <= level && ceiling.level < 3) limitReason = ceiling.label;
  else limitReason = evidenceText(e);
  return {
    actionType: row.action_type,
    label: actionLabel(row.action_type),
    level,
    levelName: LEVEL_NAMES[level],
    effectiveLevel: effective,
    effectiveLevelName: LEVEL_NAMES[effective],
    ceiling,
    suspended,
    suspendedReason: row.suspended_reason,
    paused: pause.paused,
    candidateLevel: row.candidate_level === null ? null : asLevel(row.candidate_level),
    evidence: e,
    evidenceText: evidenceText(e),
    limitReason,
    lastChange: { kind: row.last_change_kind, by: row.last_change_by, reason: row.last_change_reason, at: row.last_change_at },
  };
}

export function getProfile(db: DatabaseSync, type: string, now?: string): AutonomyProfile | null {
  ensureAutonomy(db);
  const row = reviewProfile(db, type, now);
  if (!row) return null;
  return toProfile(db, row, getPauseState(db), loadPolicies(db));
}

export function listProfiles(db: DatabaseSync, now?: string): AutonomyProfile[] {
  ensureAutonomy(db);
  reviewAll(db, now);
  const pause = getPauseState(db);
  const policies = loadPolicies(db);
  const rows = all<AutonomyProfileRow>(db, "SELECT * FROM autonomy_profiles");
  return rows
    .map((r) => toProfile(db, r, pause, policies))
    .sort((a, b) => b.level - a.level || b.evidence.verified - a.evidence.verified || a.actionType.localeCompare(b.actionType));
}

export function listChanges(db: DatabaseSync, opts: { actionType?: string; limit?: number } = {}): AutonomyChangeRow[] {
  const limit = opts.limit ?? 50;
  return opts.actionType
    ? all<AutonomyChangeRow>(
        db,
        "SELECT * FROM autonomy_changes WHERE action_type = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
        [opts.actionType, limit],
      )
    : all<AutonomyChangeRow>(db, "SELECT * FROM autonomy_changes ORDER BY created_at DESC, rowid DESC LIMIT ?", [limit]);
}

export function autonomyOverview(db: DatabaseSync, now?: string) {
  const profiles = listProfiles(db, now);
  return { pause: getPauseState(db), profiles, changes: listChanges(db, { limit: 30 }) };
}

// ─── Human governance ───────────────────────────────────────────────────────

function refusePromotion(db: DatabaseSync, type: string, level: number, target: number | null, actor: string, reason: string, e: AutonomyEvidence | null, now: string, status: 400 | 403 | 409): never {
  recordChange(db, {
    actionType: type,
    kind: "promotion_refused",
    from: level,
    to: target,
    actor: actor || "unknown",
    reason,
    evidence: e ? evidenceSummary(e) : {},
    now,
  });
  throw new AutonomyError(reason, status);
}

/**
 * The ONLY path that raises a level. Requires a named human, one level at a time, never above the policy
 * ceiling, never while suspended or paused, and only when the evidence already makes it a candidate.
 */
export function approvePromotion(
  db: DatabaseSync,
  type: string,
  opts: ChangeOpts & { toLevel?: number } = {},
): AutonomyProfile {
  ensureAutonomy(db);
  const now = nowIso(opts.now);
  const actor = (opts.actor || "").trim();
  const row = reviewProfile(db, type, now);
  if (!row) throw new AutonomyError(`No autonomy profile for ${type}.`, 404);
  const level = asLevel(row.level);
  const target = level + 1;
  const e = evidenceFor(db, type);
  const ceiling = policyCeiling(type, loadPolicies(db));

  if (!isHumanActor(actor)) {
    refusePromotion(db, type, level, target, actor, "Promotion requires approval by a named human. Evidence alone never promotes.", e, now, 403);
  }
  if (opts.toLevel !== undefined && opts.toLevel !== target) {
    refusePromotion(db, type, level, opts.toLevel, actor, `Promotions move one level at a time (${level} → ${target}).`, e, now, 400);
  }
  if (getPauseState(db).paused) {
    refusePromotion(db, type, level, target, actor, "Emergency pause is on. Resume before promoting.", e, now, 409);
  }
  if (row.suspended) {
    refusePromotion(db, type, level, target, actor, "Action is suspended. Reinstate it before promoting.", e, now, 409);
  }
  if (level >= 4) {
    refusePromotion(db, type, level, null, actor, "Already at the highest level.", e, now, 409);
  }
  if (target > ceiling.level) {
    refusePromotion(
      db,
      type,
      level,
      target,
      actor,
      `${ceiling.label}: policy caps ${actionLabel(type)} at level ${ceiling.level} (${LEVEL_NAMES[ceiling.level]}). ${ceiling.policyReason}`,
      e,
      now,
      409,
    );
  }
  const check = meetsRequirements(asLevel(target), e);
  if (!check.ok) {
    refusePromotion(db, type, level, target, actor, `Not a promotion candidate: ${check.why}.`, e, now, 409);
  }

  run(db, "UPDATE autonomy_profiles SET level = ?, evidence_mark = ?, candidate_level = NULL WHERE action_type = ?", [
    target,
    e.verified,
    type,
  ]);
  const reason = opts.reason || `Human approved promotion to ${LEVEL_NAMES[asLevel(target)]} on ${check.why}.`;
  recordChange(db, { actionType: type, kind: "promotion", from: level, to: target, actor, reason, evidence: evidenceSummary(e), now });
  markChange(db, type, "promotion", actor, reason, now);
  return getProfile(db, type, now)!;
}

function suspendInternal(
  db: DatabaseSync,
  row: AutonomyProfileRow,
  input: { actor: string; reason: string; now: string; evidence: Record<string, unknown> },
) {
  const e = evidenceFor(db, row.action_type);
  run(
    db,
    "UPDATE autonomy_profiles SET suspended = 1, suspended_reason = ?, candidate_level = NULL, evidence_mark = ? WHERE action_type = ?",
    [input.reason, e.verified, row.action_type],
  );
  recordChange(db, {
    actionType: row.action_type,
    kind: "suspension",
    from: row.level,
    to: 0,
    actor: input.actor,
    reason: input.reason,
    evidence: input.evidence,
    now: input.now,
  });
  markChange(db, row.action_type, "suspension", input.actor, input.reason, input.now);
}

/** Humans or engines may suspend. Suspension keeps the stored level; effective autonomy drops to 0. */
export function suspendAction(db: DatabaseSync, type: string, opts: ChangeOpts = {}): AutonomyProfile {
  ensureAutonomy(db);
  const now = nowIso(opts.now);
  const row = getRow(db, type);
  if (!row) throw new AutonomyError(`No autonomy profile for ${type}.`, 404);
  if (!row.suspended) {
    suspendInternal(db, row, {
      actor: opts.actor || "operator",
      reason: opts.reason || "Suspended by operator.",
      now,
      evidence: evidenceSummary(evidenceFor(db, type)),
    });
  }
  return getProfile(db, type, now)!;
}

/** Automatic suspension: a severe failure reported by an engine. */
export function reportSevereFailure(db: DatabaseSync, type: string, opts: { reason: string; ref?: string; now?: string }) {
  return suspendAction(db, type, {
    actor: ENGINE_ACTOR,
    reason: `Severe failure${opts.ref ? ` (${opts.ref})` : ""}: ${opts.reason}`,
    now: opts.now,
  });
}

/** Automatic suspension: something tried to run an instance that policy blocks. */
export function reportPolicyViolationAttempt(
  db: DatabaseSync,
  type: string,
  opts: { reason: string; payload?: Record<string, unknown>; now?: string },
) {
  return suspendAction(db, type, {
    actor: ENGINE_ACTOR,
    reason: `Policy violation attempt: ${opts.reason}`,
    now: opts.now,
  });
}

export function reinstateAction(db: DatabaseSync, type: string, opts: ChangeOpts = {}): AutonomyProfile {
  ensureAutonomy(db);
  const now = nowIso(opts.now);
  const actor = (opts.actor || "").trim();
  const row = getRow(db, type);
  if (!row) throw new AutonomyError(`No autonomy profile for ${type}.`, 404);
  if (!isHumanActor(actor)) throw new AutonomyError("Reinstatement requires a named human.", 403);
  if (!row.suspended) return getProfile(db, type, now)!;
  const e = evidenceFor(db, type);
  run(db, "UPDATE autonomy_profiles SET suspended = 0, suspended_reason = '', evidence_mark = ? WHERE action_type = ?", [
    e.verified,
    type,
  ]);
  const reason = opts.reason || `Reinstated at ${LEVEL_NAMES[asLevel(row.level)]} after human review.`;
  recordChange(db, { actionType: type, kind: "reinstatement", from: 0, to: row.level, actor, reason, evidence: evidenceSummary(e), now });
  markChange(db, type, "reinstatement", actor, reason, now);
  return getProfile(db, type, now)!;
}

// ─── Autopilot / playbook gate ──────────────────────────────────────────────

/**
 * AUTOPILOT INTEGRATION SEAM.
 *
 * `autonomyGate(db, actionType, { payload | policyOutcome })` is the one question the Exception Autopilot
 * (lib/autopilot, decision matrix rule R12_SAFE_AUTO) and any playbook runner should ask before running an
 * action without a human:
 *
 *   gate.mayAutoExecute   → the autopilot may execute now (still through executeAction, which re-checks policy)
 *   gate.requiresApproval → prepare it and route to NEEDS_APPROVAL
 *   gate.blocked          → policy blocks this instance; never run it (R02_POLICY_BLOCKED)
 *
 * Order of authority: emergency pause → suspension → policy (instance, then type ceiling) → earned level.
 * The gate reviews fresh evidence first, so an automatic demotion takes effect before the decision.
 * It never raises a level and never calls the network.
 */
export function autonomyGate(
  db: DatabaseSync,
  actionType: string,
  opts: { payload?: Record<string, unknown>; policyOutcome?: PolicyOutcome; policyReason?: string; now?: string } = {},
): AutonomyGateResult {
  ensureAutonomy(db);
  const policies = loadPolicies(db);
  const inst = instancePolicy(actionType, policies, opts);
  const ceiling = policyCeiling(actionType, policies);
  const row = reviewProfile(db, actionType, opts.now);
  const pause = getPauseState(db);

  const result = (level: AutonomyLevel, mode: AutonomyMode, reason: string): AutonomyGateResult => ({
    actionType,
    level,
    levelName: LEVEL_NAMES[level],
    ceiling: ceiling.level,
    mode,
    mayAutoExecute: mode === "auto",
    requiresApproval: mode !== "auto" && mode !== "blocked",
    blocked: mode === "blocked",
    policyOutcome: inst.outcome,
    actionGate: mode === "auto" ? "AUTO" : mode === "blocked" ? "BLOCKED" : "NEEDS_APPROVAL",
    reason,
  });

  if (inst.outcome === "BLOCKED") return result(0, "blocked", `Policy blocks this action: ${inst.reason}`);
  if (pause.paused) return result(0, "observe", `Emergency pause is on (${pause.reason}). Observe only; a human decides.`);
  if (!row) return result(0, "observe", `No autonomy profile for ${actionType}. Observe only; a human decides.`);
  if (row.suspended) return result(0, "observe", `Suspended: ${row.suspended_reason} A human must reinstate it.`);

  const effective = Math.min(asLevel(row.level), ceiling.level) as AutonomyLevel;
  const capNote = ceiling.level < row.level ? ` (${ceiling.label} caps level ${row.level} at ${ceiling.level})` : "";
  const at = `Level ${effective} ${LEVEL_NAMES[effective]}${capNote}`;
  if (effective === 0) return result(0, "observe", `${at}. Observe only.`);
  if (effective === 1) return result(1, "recommend", `${at}. EvoPulse recommends; a human performs it.`);
  if (effective === 2) return result(2, "prepare", `${at}. Prepared for human approval.`);
  if (inst.outcome !== "AUTO") {
    return result(effective, "prepare", `${at}, but policy requires approval for this instance: ${inst.reason}`);
  }
  if (CUSTOMER_FACING_TYPES.has(actionType)) {
    return result(effective, "prepare", `${at}, but ${actionLabel(actionType)} is customer-facing: each run needs a human approval.`);
  }
  if (effective === 3 && !REVERSIBLE_INTERNAL_TYPES.has(actionType)) {
    return result(3, "prepare", `${at} runs only reversible, internal steps. Prepared for approval.`);
  }
  return result(effective, "auto", `${at}. Inside policy — may run without per-step approval.`);
}

/** Gate for a stored action row: live policy recheck on its payload, never looser than its stored outcome. */
export function gateAction(
  db: DatabaseSync,
  action: { type: string; payload?: string | Record<string, unknown>; policy_outcome: PolicyOutcome; policy_reason?: string },
  now?: string,
): AutonomyGateResult {
  return autonomyGate(db, action.type, {
    payload: parsePayload(action.payload),
    policyOutcome: action.policy_outcome,
    policyReason: action.policy_reason,
    now,
  });
}

function parsePayload(raw: string | Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === "object") return raw;
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Playbook step autonomy: each step of a multi-action plan gets its own gate. A plan can auto-run step A
 * (checkpoint at L4) while step B (customer follow-up) waits for approval.
 */
export function annotatePlanActions<
  T extends {
    id: string;
    type: string;
    payload?: string | Record<string, unknown>;
    policy_outcome: PolicyOutcome;
    policy_reason?: string;
    status?: string;
  },
>(db: DatabaseSync, actions: T[], now?: string) {
  const steps = actions.map((action) => ({ ...action, autonomy: gateAction(db, action, now) }));
  return {
    steps,
    autoRun: steps.filter((s) => s.autonomy.mayAutoExecute).map((s) => s.id),
    awaitingApproval: steps.filter((s) => s.autonomy.requiresApproval).map((s) => s.id),
    blocked: steps.filter((s) => s.autonomy.blocked).map((s) => s.id),
  };
}

// ─── Bootstrap + event hooks ────────────────────────────────────────────────

const hooked = new WeakSet<DatabaseSync>();

/** Re-review the matching profile whenever the Outcome Ledger or human feedback records something. */
export function ensureAutonomyHooks(db: DatabaseSync) {
  if (hooked.has(db)) return;
  hooked.add(db);
  registerEngineHook("autonomy-review", (event: BusinessEvent) => {
    try {
      let actionId: string | null = null;
      if (event.type === LEARNING_EVENT_TYPES.OUTCOME_RECORDED && event.entity_id) {
        actionId = one<{ action_id: string | null }>(db, "SELECT action_id FROM outcomes WHERE id = ?", [event.entity_id])?.action_id ?? null;
      } else if (event.type === LEARNING_EVENT_TYPES.FEEDBACK_RECORDED) {
        actionId = event.entity_id;
      }
      if (!actionId) return;
      const type = one<{ type: string }>(db, "SELECT type FROM actions WHERE id = ?", [actionId])?.type;
      if (type) reviewProfile(db, type, event.received_at || event.occurred_at);
    } catch (error) {
      console.error("[autonomy] review hook failed", event.id, event.type, error);
    }
  });
}

/** Lazily seeds profiles on databases created before this module existed, and wires the review hook. */
export function ensureAutonomy(db: DatabaseSync) {
  ensureAutonomyHooks(db);
  if (countProfiles(db) > 0) return;
  // Lazy import keeps service ↔ seed acyclic at module load.
  const { seedAutonomy } = require("./seed") as typeof import("./seed");
  seedAutonomy(db);
}
