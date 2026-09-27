/**
 * Adaptive Autonomy — earned control, action by action (PLAN.md §23).
 *
 * Integration seam for the Exception Autopilot and playbook runners: `autonomyGate` and
 * `annotatePlanActions`. See the doc comment on `autonomyGate` in ./service.
 */
export {
  AUTONOMY_ACTIONS,
  FINANCIAL_TYPES,
  CUSTOMER_FACING_TYPES,
  REVERSIBLE_INTERNAL_TYPES,
  actionLabel,
  canonicalPayload,
  policyCeiling,
} from "./ceilings";
export { autonomyHistorySignature, evidenceFor, evidenceText } from "./evidence";
export {
  DEMOTION_FLOORS,
  DEMOTION_MIN_SAMPLE,
  FAILURE_STREAK_DEMOTION,
  PROMOTION_REQUIREMENTS,
  RECENT_WINDOW,
  SEVERE_RESULTS,
  demotionTrigger,
  isHumanActor,
  meetsRequirements,
} from "./rules";
export { AUTONOMY_PAUSE_META_KEY, AUTONOMY_TABLES, migrateAutonomyTables, wipeAutonomyTables } from "./schema";
export { AUTONOMY_SYNTHETIC_PREFIX, SEEDED_AUTONOMY, reseedAutonomy, seedAutonomy } from "./seed";
export {
  AutonomyError,
  ENGINE_ACTOR,
  GLOBAL_SCOPE,
  annotatePlanActions,
  approvePromotion,
  autonomyGate,
  autonomyOverview,
  emergencyPause,
  emergencyResume,
  ensureAutonomy,
  ensureAutonomyHooks,
  gateAction,
  getPauseState,
  getProfile,
  listChanges,
  listProfiles,
  reinstateAction,
  reportPolicyViolationAttempt,
  reportSevereFailure,
  reviewAll,
  reviewProfile,
  suspendAction,
} from "./service";
export { adaptiveAutonomyGate, policyOnlyGate, type AutonomyGateSource } from "./autopilot";
export * from "./types";
