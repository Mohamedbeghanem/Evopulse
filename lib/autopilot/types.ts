export const AUTOPILOT_STATES = [
  "NORMAL",
  "MONITORING",
  "PREPARED",
  "AUTO_HANDLED",
  "NEEDS_APPROVAL",
  "NEEDS_YOU",
  "BLOCKED",
  "HANDLED",
] as const;
export type AutopilotState = (typeof AUTOPILOT_STATES)[number];

export const AUTOPILOT_REASON_CODES = [
  "NO_INTERVENTION_REQUIRED",
  "EARLY_WARNING_MONITORING",
  "SAFE_INTERNAL_ACTION",
  "ACTION_PREPARED",
  "EXTERNAL_ACTION_REQUIRES_APPROVAL",
  "FINANCIAL_ACTION_REQUIRES_APPROVAL",
  "POLICY_BLOCKED",
  "HIGH_IMPACT_HUMAN_JUDGMENT",
  "VERIFICATION_PENDING",
  "VERIFICATION_FAILED",
  "VERIFIED_RESOLVED",
] as const;
export type AutopilotReasonCode = (typeof AUTOPILOT_REASON_CODES)[number];

export type AutopilotSituationType = "exception" | "warning" | "action" | "event";

export type AutopilotDecisionRow = {
  id: string;
  situation_type: AutopilotSituationType;
  situation_id: string;
  classification: AutopilotState;
  reason_code: AutopilotReasonCode;
  warning_id: string | null;
  exception_id: string | null;
  goal_id: string | null;
  plan_id: string | null;
  action_id: string | null;
  policy_decision: string | null;
  impact_summary: string;
  evidence: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  metadata: string;
};

export type ClassifyInput = {
  hasException: boolean;
  exceptionKind?: string;
  exceptionAttention?: string;
  exceptionStatus?: string;
  isSupplierCascade: boolean;
  affectedOrders: number;
  associatedRevenue: number;
  warningActive: boolean;
  bufferState?: string;
  deadlineFuture: boolean;
  hasPlan: boolean;
  hasApprovalRequired: boolean;
  hasFinancialApproval: boolean;
  hasBlockedAction: boolean;
  hasAutoExecuted: boolean;
  verificationStatus?: "PENDING" | "SUCCESS" | "FAILED" | null;
};

export type ClassifyResult = {
  classification: AutopilotState;
  reasonCode: AutopilotReasonCode;
  explanation: string;
};

export type AutopilotCard = {
  id: string;
  classification: AutopilotState;
  reasonCode: AutopilotReasonCode;
  title: string;
  happened: string;
  whyItMatters: string;
  alreadyDone: string[];
  needsFromYou: string;
  href: string;
  warningId: string | null;
  exceptionId: string | null;
  planId: string | null;
  actionId: string | null;
  associatedRevenue: number | null;
  currency: string;
};

export type AutopilotSummary = {
  eventsProcessed: number;
  normal: number;
  monitoring: number;
  prepared: number;
  autoHandled: number;
  needsApproval: number;
  needsYou: number;
  blocked: number;
  handled: number;
};

export type AutopilotTrace = {
  decision: AutopilotCard;
  observed: string;
  detected: string;
  impact: string;
  plan: string;
  policy: string;
  autopilot: string;
  current: AutopilotState;
  historical?: string;
};

export const AUTOPILOT_THRESHOLDS = {
  HIGH_IMPACT_ORDERS: 2,
  HIGH_IMPACT_REVENUE: 250000,
  MAX_RETRIES: 1,
} as const;
