export {
  AUTOMATION_STATUSES,
  LEARNING_THRESHOLDS,
  confidenceFromObservations,
  formatObservedRate,
  patternStatusFromObservations,
  successRate,
} from "./confidence";
export {
  COMPATIBLE_EXCEPTION_KINDS,
  SEED_FOLLOWUP_CONTEXT,
  SEED_FOLLOWUP_SIGNATURE,
  buildContextSignature,
  contextFromException,
  isLearningCompatibleKind,
  mapExceptionKindToProblem,
  signatureFromException,
  valueBand,
} from "./context";
export { ensureLearningHooks, expireAndRecord, handleLearningEvent } from "./event-adapter";
export { HumanFeedbackService } from "./feedback";
export { OutcomeLedger } from "./outcomes";
export { LEARNING_TABLES, migrateLearningTables, wipeLearningTables } from "./schema";
export {
  SYNTHETIC_STRATEGY_TARGETS,
  reseedSyntheticLearningData,
  seedSyntheticLearningData,
} from "./seed-outcomes";
export {
  StrategyMemory,
  evidenceForCompatibleKind,
  pickHistoricallyStronger,
  strategyLabel,
} from "./strategy-memory";
export { addHours, isAtOrAfter, secondsBetween } from "./time";
export {
  EXPECTED_EVENT_ALIASES,
  FEEDBACK_DECISIONS,
  LEARNING_STRATEGIES,
  PATTERN_STATUSES,
  VERIFICATION_STATUSES,
  type ActionFeedbackRow,
  type ContextFields,
  type FeedbackDecision,
  type HistoricallyStronger,
  type LearnedPatternRow,
  type LearningStrategy,
  type OutcomeRow,
  type PatternStatus,
  type StrategyEvidence,
  type StrategyEvidenceBundle,
  type VerificationRow,
  type VerificationStatus,
} from "./types";
export {
  LEARNING_EVENT_TYPES,
  VerificationService,
  applyVerificationToException,
  inferStrategyFromAction,
  isVerifiableAction,
  markExceptionAwaitingVerification,
} from "./verification";
