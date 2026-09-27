import type { BufferState } from "./buffer";

export type WarningStatus = "ACTIVE" | "RESOLVED" | "TRANSITIONED";
export type WarningSeverity = "CRITICAL" | "HIGH" | "MONITORING";
export type WarningKind = "delivery_shortfall" | "inactivity_window";

export type WarningChild = {
  entityId: string;
  entityType: string;
  label: string;
  state: BufferState;
  availableHours: number;
  requiredHours: number;
  shortfallHours: number;
  bufferHours: number;
  valueAmount: number;
  currency: string;
  customer: string;
  deadlineAt: string;
};

export type EvidenceHop = {
  id: string;
  type: string;
  label: string;
};

export type WarningEvidence = {
  source: string;
  quote: string;
  eventId: string | null;
  eventType: string | null;
  occurredAt: string | null;
  path: EvidenceHop[];
  confidence: number;
};

/** Preserved so a later learning pass can join warning → action → verification → outcome. */
export type WarningLearningContext = {
  warningId: string;
  problem_type: string;
  context_signature: string;
  entity_type: string;
  entity_id: string;
  exception_id: string | null;
  action_id: string | null;
  verification_id: string | null;
  outcome_id: string | null;
};

export type WarningRow = {
  id: string;
  status: WarningStatus;
  severity: WarningSeverity;
  buffer_state: BufferState;
  kind: WarningKind;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  headline: string;
  summary: string;
  explanation: string;
  available_hours: number | null;
  required_hours: number | null;
  shortfall_hours: number | null;
  buffer_hours: number | null;
  deadline_at: string | null;
  projected_at: string | null;
  value_amount: number;
  currency: string;
  cash_amount: number;
  confidence: number;
  source: string;
  source_event_id: string | null;
  domain: string;
  exception_id: string | null;
  evidence_json: string;
  children_json: string;
  context_json: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type SimulationScenario = {
  entityType: string;
  entityId: string;
  question: string;
  deltaDays: number;
};

export type WarningView = {
  id: string;
  status: WarningStatus;
  severity: WarningSeverity;
  bufferState: BufferState;
  kind: WarningKind;
  entityType: string;
  entityId: string;
  entityLabel: string;
  headline: string;
  summary: string;
  explanation: string;
  failed: boolean;
  failedAnswer: string;
  source: string;
  confidence: number;
  availableHours: number | null;
  requiredHours: number | null;
  shortfallHours: number | null;
  bufferHours: number | null;
  deadlineAt: string | null;
  projectedAt: string | null;
  valueAmount: number;
  currency: string;
  cashAmount: number;
  valueLabel: string;
  timeLabel: string;
  children: WarningChild[];
  evidence: WarningEvidence;
  learning: WarningLearningContext;
  exceptionId: string | null;
  domain: string;
  scenario: SimulationScenario | null;
};

export type DomainSignal = {
  status: "AT RISK" | "MONITORING" | "CLEAR";
  line: string;
};

export type BusinessTwin = {
  operations: DomainSignal;
  customers: DomainSignal;
  cash: DomainSignal;
};

export type GoalContext = {
  goal: string;
  generatedAt: string;
  exceptions: { id: string; title: string; kind: string; attention: string; status: string }[];
  earlyWarnings: {
    id: string;
    headline: string;
    summary: string;
    severity: WarningSeverity;
    confidence: number;
    entityId: string;
    shortfallHours: number | null;
    valueAmount: number;
    currency: string;
  }[];
  note: string;
};
