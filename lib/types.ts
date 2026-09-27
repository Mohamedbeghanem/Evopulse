export type ActorKind = "company" | "customer";
export type Attention = "NEEDS_YOU" | "MONITORING" | "HANDLED" | "HEALTHY";
export type ExpectationStatus =
  | "ON_TRACK"
  | "UPCOMING"
  | "AT_RISK"
  | "MISSED"
  | "FULFILLED"
  | "BLOCKED"
  | "CANCELLED";
export type PolicyOutcome = "AUTO" | "APPROVAL_REQUIRED" | "BLOCKED";
export type ActionType =
  | "prepare_proposal"
  | "draft_message"
  | "send_message"
  | "create_checkpoint"
  | "apply_discount"
  | "offer_alternative";

export type EntityRow = {
  id: string;
  type: string;
  name: string;
  payload: string;
  created_at: string;
};

export type EventRow = {
  id: string;
  type: string;
  source: string;
  source_id: string | null;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: string;
  occurred_at: string;
  received_at: string;
  confidence: number;
  metadata: string;
  /** Present on DBs created before the unified event layer. */
  created_at?: string;
};

export type CommitmentRow = {
  id: string;
  actor: ActorKind;
  actor_entity_id: string | null;
  action: string;
  description: string;
  deadline: string;
  status: string;
  source_event_id: string | null;
  evidence: string;
  confidence: number;
  model: string;
  created_at: string;
};

export type ExpectationRow = {
  id: string;
  commitment_id: string;
  description: string;
  due_at: string;
  status: ExpectationStatus;
  actual: string;
  created_at: string;
  updated_at: string;
};

export type DependencyRow = {
  id: string;
  from_id: string;
  from_type: string;
  to_id: string;
  to_type: string;
  description: string;
};

export type ExceptionRow = {
  id: string;
  title: string;
  kind: string;
  expectation_id: string | null;
  opportunity_id: string | null;
  attention: Attention;
  severity: string;
  urgency: string;
  impact_json: string;
  evidence_json: string;
  confidence: number;
  status: string;
  created_at: string;
};

export type PlanRow = {
  id: string;
  exception_id: string;
  title: string;
  summary: string;
  status: string;
  model: string;
  created_at: string;
};

export type ActionRow = {
  id: string;
  exception_id: string;
  plan_id: string | null;
  type: string;
  title: string;
  description: string;
  payload: string;
  policy_outcome: PolicyOutcome;
  policy_reason: string;
  status: string;
  evidence_json: string;
  created_at: string;
};

export type PolicyRow = {
  id: string;
  key: string;
  value: string;
  description: string;
};

export type ExtractedCommitment = {
  actor: ActorKind;
  action: string;
  description: string;
  deadline: string;
  evidence: string;
  confidence: number;
};

export type ExtractionResult = {
  commitments: ExtractedCommitment[];
  dependencies: { dependentAction: string; prerequisiteAction: string; description: string }[];
  amount: number | null;
  currency: string | null;
  requestedDiscountPct: number | null;
  model: string;
  source: "ai" | "heuristic";
  evidence: string;
};

export type Impact = {
  customersAffected: number;
  opportunitiesAffected: number;
  revenueAssociated: number;
  currency: string;
  cashTimingAffected: boolean;
  urgency: string;
  notes: string;
};

export type EvidencePack = {
  source: string;
  quote: string;
  expected: string;
  actual: string;
  deal: string;
  confidence: number;
};

export type DemoPhase =
  | "seeded"
  | "recovered"
  | "discount_blocked";
