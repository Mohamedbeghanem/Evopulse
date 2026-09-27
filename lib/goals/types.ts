import type { GoalStatus, GoalType, PolicyOutcome } from "../types";
import type { StrategyEvidenceBundle } from "../learning/types";

export const GOAL_TYPES: GoalType[] = [
  "protect_business",
  "protect_revenue",
  "protect_cash",
  "recover_opportunities",
  "protect_customer_commitments",
];

export const GOAL_STATUSES: GoalStatus[] = ["DRAFT", "ACTIVE", "AT_RISK", "COMPLETED", "CANCELLED"];

export type RiskDomain = "sales" | "operations" | "cash" | "customers";

export type EvidenceKind =
  | "OBSERVED_FACT"
  | "CALCULATED_IMPACT"
  | "HISTORICAL_EVIDENCE"
  | "POLICY_DECISION"
  | "AI_RECOMMENDATION";

export type RiskEvidence = {
  kind: EvidenceKind;
  source: string;
  quote: string;
  expected?: string;
  actual?: string;
  path: string[];
};

export type BusinessRisk = {
  id: string;
  domain: RiskDomain;
  kind: string;
  title: string;
  associatedValue: number;
  currency: string;
  affectedOrders: number;
  affectedCustomers: number;
  exceptionId?: string;
  entityIds: string[];
  evidence: RiskEvidence;
  severity: string;
  urgency: string;
  deadline?: string;
  dependencyCount: number;
  status: string;
  resolved: boolean;
};

export type PriorityBreakdown = {
  severityWeight: number;
  deadlineWeight: number;
  impactWeight: number;
  dependencyWeight: number;
  customerWeight: number;
  score: number;
  whyFirst: string;
};

export type RankedRisk = BusinessRisk & { rank: number; priority: PriorityBreakdown };

export type GoalInput = {
  utterance?: string;
  goalType?: string;
  scope?: string;
  deadline?: string;
  constraints?: Record<string, unknown>;
  source?: string;
};

export type InterpretedGoal = {
  goalType: GoalType;
  scope: string;
  objective: string;
  metric: string;
  target: string;
  deadline: string;
  constraints: Record<string, unknown>;
  source: "structured" | "utterance";
};

export type GoalContext = {
  goal: InterpretedGoal & { id?: string; status?: GoalStatus };
  risks: RankedRisk[];
  exceptions: Array<{ id: string; kind: string; title: string; status: string; attention: string }>;
  impacts: Array<{ riskId: string; associatedValue: number; cashTimingAmount: number; kind: EvidenceKind }>;
  policies: Record<string, string>;
  strategyEvidence: StrategyEvidenceBundle | null;
  pendingApprovals: number;
};

export type ActionEvidence = {
  kind: EvidenceKind;
  reason: string;
  sourceExceptionId?: string;
  sourceEntityIds: string[];
  quote?: string;
  path: string[];
  associatedValue?: number;
  historicalEvidence?: StrategyEvidenceBundle | null;
};

export type CandidateAction = {
  type: string;
  domain: RiskDomain;
  targetType: string;
  targetId: string;
  title: string;
  description: string;
  parameters: Record<string, unknown>;
  reason: string;
  evidence: ActionEvidence;
  priority: number;
  risk: string;
  confidence: number;
  dependencies: string[];
  relatedExceptionId: string;
  relatedRiskId: string;
};

export type ClassifiedAction = CandidateAction & {
  id?: string;
  policyDecision: PolicyOutcome;
  policyReason: string;
  requiresApproval: boolean;
};

export type PlanSummary = {
  totalActions: number;
  autoActions: number;
  approvalRequiredActions: number;
  blockedActions: number;
  affectedDomains: RiskDomain[];
  associatedValueAddressed: number;
  valueUnderAttention: number;
  cashTimingUnderAttention: number;
  currency: string;
};

export type StructuredPlan = {
  id?: string;
  goalId: string;
  status: string;
  summary: string;
  expectedImpact: PlanSummary;
  actions: ClassifiedAction[];
  simulation: {
    evaluable: true;
    snapshotHint: {
      goalId: string;
      planId?: string;
      actionIds: string[];
      domains: RiskDomain[];
      associatedValue: number;
    };
  };
};

export const ACTION_CATALOG = [
  "prepare_proposal",
  "draft_message",
  "send_message",
  "send_simulated_message",
  "create_checkpoint",
  "create_task",
  "schedule_followup",
  "update_expectation",
  "prioritize_order",
  "prepare_customer_notice",
  "escalate",
  "monitor",
  "update_record",
  "apply_discount",
  "offer_alternative",
] as const;

export type CatalogActionType = (typeof ACTION_CATALOG)[number];
