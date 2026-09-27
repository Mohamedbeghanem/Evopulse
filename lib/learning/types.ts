export const VERIFICATION_STATUSES = ["PENDING", "SUCCESS", "FAILED", "CANCELLED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const PATTERN_STATUSES = [
  "OBSERVED",
  "INSUFFICIENT_DATA",
  "EMERGING_PATTERN",
  "RELIABLE_PATTERN",
  "CANDIDATE_AUTOMATION",
  "APPROVED_AUTOMATION",
] as const;
export type PatternStatus = (typeof PATTERN_STATUSES)[number];

export const FEEDBACK_DECISIONS = ["ACCEPT", "EDIT", "REJECT"] as const;
export type FeedbackDecision = (typeof FEEDBACK_DECISIONS)[number];

export const LEARNING_STRATEGIES = ["personalized_followup", "generic_followup", "call_first"] as const;
export type LearningStrategy = (typeof LEARNING_STRATEGIES)[number];

/** Expected-event aliases. Event Layer emits customer.replied; verifications store customer.response. */
export const EXPECTED_EVENT_ALIASES: Record<string, string[]> = {
  "customer.response": ["customer.response", "customer.replied"],
  "customer.replied": ["customer.replied", "customer.response"],
};

export type ContextFields = {
  problem_type: string;
  customer_type: string;
  value_band: string;
  silence_band: string;
};

export type VerificationRow = {
  id: string;
  action_id: string;
  exception_id: string;
  expected_event_type: string;
  expected_by: string;
  status: VerificationStatus;
  success_condition: string;
  failure_condition: string;
  created_at: string;
  resolved_at: string | null;
  evidence: string;
  metadata: string;
};

export type OutcomeRow = {
  id: string;
  problem_type: string;
  context_signature: string;
  exception_id: string | null;
  plan_id: string | null;
  action_id: string | null;
  verification_id: string | null;
  strategy: string;
  result: string;
  success: number;
  time_to_result: number | null;
  business_effect: string;
  policy_state: string;
  human_feedback: string | null;
  created_at: string;
};

export type LearnedPatternRow = {
  id: string;
  pattern_type: string;
  context_signature: string;
  strategy: string;
  observations: number;
  successes: number;
  failures: number;
  success_rate: number;
  confidence: number;
  status: PatternStatus;
  first_observed_at: string;
  last_updated_at: string;
  metadata: string;
};

export type ActionFeedbackRow = {
  id: string;
  action_id: string;
  decision: FeedbackDecision;
  original_strategy: string;
  final_strategy: string;
  reason: string;
  created_at: string;
};

export type StrategyEvidence = {
  strategy: string;
  label: string;
  observations: number;
  successes: number;
  failures: number;
  success_rate: number;
  pattern_status: PatternStatus;
  confidence: number;
  evidence: string;
  synthetic_observations: number;
};

export type HistoricallyStronger = {
  strategy: string;
  label: string;
  observations: number;
  success_rate: number;
  wording: string;
};

export type StrategyEvidenceBundle = {
  context_signature: string;
  compatible: boolean;
  strategies: StrategyEvidence[];
  historically_stronger_strategy: HistoricallyStronger | null;
  note: string;
};
