export const BUFFER_STATES = ["SAFE", "TIGHT", "AT_RISK", "MISSED"] as const;
export type BufferState = (typeof BUFFER_STATES)[number];

export const WARNING_STATUSES = ["ACTIVE", "MONITORING", "RESOLVED", "ESCALATED", "DISMISSED"] as const;
export type WarningStatus = (typeof WARNING_STATUSES)[number];

export const WARNING_TYPES = ["DEADLINE_BUFFER", "DEPENDENCY_RISK", "COMMITMENT_RISK", "CASH_TIMING"] as const;
export type WarningType = (typeof WARNING_TYPES)[number];

export const WARNING_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type WarningSeverity = (typeof WARNING_SEVERITIES)[number];

export const REASON_CODES = [
  "BUFFER_TIGHT",
  "BUFFER_NEGATIVE",
  "UPSTREAM_DELAY",
  "DEPENDENCY_AT_RISK",
  "CUSTOMER_COMMITMENT_AT_RISK",
  "CASH_TIMING_AT_RISK",
  "DEADLINE_APPROACHING",
  "HISTORICAL_PATTERN_SUPPORT",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const EVIDENCE_KINDS = [
  "OBSERVED",
  "CALCULATED",
  "DEPENDENCY",
  "HISTORICAL",
  "ASSUMPTION",
  "AI_INTERPRETATION",
] as const;
export type WarningEvidenceKind = (typeof EVIDENCE_KINDS)[number];

export type DownstreamDurations = {
  processing_minutes: number;
  preparation_minutes: number;
  transport_minutes: number;
};

export type BufferCalculation = {
  deadline: string;
  upstream_available_at: string;
  now: string;
  available_buffer_minutes: number;
  required_buffer_minutes: number;
  shortfall_minutes: number;
  surplus_minutes: number;
  durations: DownstreamDurations;
  state: BufferState;
  deadline_passed: boolean;
};

export type WarningRow = {
  id: string;
  warning_type: WarningType;
  entity_type: string;
  entity_id: string;
  expectation_id: string | null;
  status: WarningStatus;
  severity: WarningSeverity;
  detected_at: string;
  expected_failure_at: string | null;
  available_buffer_minutes: number;
  required_buffer_minutes: number;
  shortfall_minutes: number;
  source_event_id: string | null;
  evidence: string;
  confidence: number;
  resolved_at: string | null;
  metadata: string;
};

export type WarningEvidenceItem = {
  kind: WarningEvidenceKind;
  statement: string;
  source_type?: string;
  source_id?: string;
};

export type WarningSummary = {
  id: string;
  warning_type: WarningType;
  title: string;
  status: WarningStatus;
  severity: WarningSeverity;
  buffer_state: BufferState;
  entity_type: string;
  entity_id: string;
  expectation_id: string | null;
  available_buffer_minutes: number;
  required_buffer_minutes: number;
  shortfall_minutes: number;
  detected_at: string;
  expected_failure_at: string | null;
  reason_codes: ReasonCode[];
  failed: boolean;
  path_labels: string[];
};

export type WarningExplanation = {
  warning: WarningSummary;
  has_failed: boolean;
  source_events: Array<{ id: string; type: string; occurred_at: string }>;
  expectation: { id: string; description: string; due_at: string; status: string } | null;
  dependency_path: { nodeIds: string[]; labels: string[]; relationships: string[] };
  current_state: {
    now: string;
    upstream_available_at: string;
    deadline: string;
    buffer: BufferCalculation;
  };
  available_buffer: string;
  required_buffer: string;
  shortfall: string;
  impact: {
    affected_orders: number;
    affected_customers: number;
    associated_revenue: number;
    affected_expected_cash: number;
    currency: string;
    notes: string;
  };
  assumptions: string[];
  historical_evidence: { wording: string; observations: number; sufficient: boolean };
  classification: BufferState;
  evidence: WarningEvidenceItem[];
  simulation: {
    warning_id: string;
    root_entity_id: string;
    deadline: string;
    available_buffer_minutes: number;
    required_buffer_minutes: number;
    dependency_path: string[];
    impact_associated_revenue: number;
  };
};
