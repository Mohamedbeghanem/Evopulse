import type { CommandIntent, CommandLink, SourceSystem } from "../command/types";

// "manus": the OpenManus-native planning agent (lib/agents/manus). Same tables, same governed executor.
export const AGENT_RUNTIME_MODES = ["deterministic", "deepseek", "manus"] as const;
export type AgentRuntimeMode = (typeof AGENT_RUNTIME_MODES)[number];

export const TOOL_PERMISSIONS = [
  "READ",
  "PREPARE",
  "EXECUTE_SAFE",
  "HUMAN_REQUIRED",
  "FORBIDDEN_TO_AGENT",
] as const;
export type ToolPermission = (typeof TOOL_PERMISSIONS)[number];

export const AGENT_PHASES = [
  "IDLE",
  "INTERPRETING",
  "RUNNING_TOOL",
  "WAITING_FOR_TOOL",
  "WAITING_FOR_APPROVAL",
  "EXECUTING",
  "VERIFYING",
  "COMPLETE",
  "FAILED",
  "CANCELLED",
] as const;
export type AgentPhase = (typeof AGENT_PHASES)[number];

export const AGENT_RUN_STATUSES = [
  "queued",
  "running",
  "waiting_for_approval",
  "complete",
  "failed",
  "cancelled",
] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const TOOL_NAMES = [
  "get_business_state",
  "get_recent_changes",
  "get_attention",
  "get_upcoming_risks",
  "explain_risk",
  "get_evidence",
  "simulate_change",
  "create_goal",
  "generate_plan",
  "evaluate_plan",
  "get_safe_actions",
  "execute_safe_actions",
  "request_action_approval",
  "approve_action",
  "get_verification",
  "get_historical_cases",
  "get_policy",
  "get_autopilot_trace",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const FORBIDDEN_CAPABILITIES = [
  "mutate_policy",
  "mutate_permissions",
  "execute_sql",
  "shell",
  "write_file",
  "delete_records",
  "approve_action",
] as const;
export type ForbiddenCapability = (typeof FORBIDDEN_CAPABILITIES)[number];

export type ToolSchema = {
  name: string;
  description: string;
  permission: ToolPermission;
  parameters: Record<string, { type: string; required?: boolean; description: string }>;
};

export type ToolEvidence = {
  statement: string;
  sourceSystem: SourceSystem;
  sourceType?: string;
  sourceId?: string;
  timestamp?: string;
};

export type ToolPolicySlice = {
  outcome?: "AUTO" | "APPROVAL_REQUIRED" | "BLOCKED" | "NEEDS_YOU";
  reason?: string;
  discountMax?: string;
  rechecked?: boolean;
};

export type ToolResult = {
  toolCallId: string;
  tool: string;
  status: "ok" | "failed" | "blocked" | "approval_required" | "forbidden";
  data: Record<string, unknown>;
  evidence: ToolEvidence[];
  policy: ToolPolicySlice | null;
  requiresApproval: boolean;
  links: CommandLink[];
  generatedAt: string;
  error?: string;
};

export type AgentTraceStep = {
  id: string;
  seq: number;
  kind: "user" | "inspect" | "analyze" | "simulate" | "prepare" | "policy" | "execute" | "verify" | "approval" | "blocked" | "fail";
  label: string;
  detail: string;
  tool?: string;
  toolCallId?: string;
  decision?: string;
  policy?: string;
  createdAt: string;
};

export type AgentApproval = {
  id: string;
  runId: string;
  actionId: string;
  planId: string | null;
  title: string;
  why: string;
  impact: string;
  policy: string;
  evidence: string;
  status: "pending" | "approved" | "rejected" | "edited";
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
};

export type AgentToolCallRecord = {
  id: string;
  seq: number;
  tool: string;
  permission: ToolPermission;
  arguments: Record<string, unknown>;
  result: ToolResult;
  status: ToolResult["status"];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  idempotencyKey?: string;
};

export type AgentRunReport = {
  summary: string;
  intent: CommandIntent | "UNKNOWN";
  attentionCount?: number;
  associatedRevenue?: number;
  expectedCash?: number;
  orders?: number;
  customers?: number;
  simulationUnchanged?: boolean;
  safe?: number;
  approval?: number;
  blocked?: number;
  executed?: number;
  verificationPending?: number;
  policyBlocked?: boolean;
  allowedAlternative?: string;
  fallbackUsed?: boolean;
  /** Model id that answered (live provider response metadata). Absent on deterministic runs. */
  modelUsed?: string;
};

export type AgentRun = {
  id: string;
  sessionId: string;
  command: string;
  intent: string;
  status: AgentRunStatus;
  phase: AgentPhase;
  runtime: AgentRuntimeMode;
  fallbackUsed: boolean;
  error: string | null;
  summary: string;
  report: AgentRunReport;
  steps: AgentTraceStep[];
  toolCalls: AgentToolCallRecord[];
  approvals: AgentApproval[];
  startedAt: string;
  finishedAt: string | null;
  cancelledAt: string | null;
};

export type AgentSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastRunId: string | null;
  command?: string;
  intent?: string;
};

export type AgentRunRequest = {
  command: string;
  sessionId?: string;
  now?: string;
  idempotencyKey?: string;
};

export type ApprovalDecision = {
  approvalId?: string;
  actionId?: string;
  decision: "approve" | "reject" | "edit";
  actor?: string;
};

export type LoopLimits = {
  maxToolCalls: number;
  maxRuntimeMs: number;
  maxRepeatedIdenticalCalls: number;
};

export type AgentRuntime = {
  run(request: AgentRunRequest): Promise<AgentRun>;
  resume(runId: string): Promise<AgentRun>;
  cancel(runId: string): AgentRun;
  getStatus(runId: string): AgentRun;
  getTrace(runId: string): AgentTraceStep[];
  requestApproval(runId: string, actionIds?: string[]): AgentRun;
  resumeAfterApproval(runId: string, decision: ApprovalDecision): Promise<AgentRun>;
};

export const DEFAULT_LOOP_LIMITS: LoopLimits = {
  maxToolCalls: 12,
  maxRuntimeMs: 20_000,
  maxRepeatedIdenticalCalls: 2,
};

export const HARNESS_REFERENCE = {
  name: "DeepSeek Harness",
  version: "0.1.7-rc.2",
  commit: "477b4f420553e8a52c2fbccc464d7561b239c443",
  license: "MIT",
  method: "isolated-adapter",
} as const;
