import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { id } from "../ids";
import type {
  AgentApproval,
  AgentPhase,
  AgentRun,
  AgentRunReport,
  AgentRunStatus,
  AgentRuntimeMode,
  AgentSession,
  AgentToolCallRecord,
  AgentTraceStep,
  ToolResult,
} from "./types";

export type RunContext = {
  goalId?: string;
  planId?: string;
  warningId?: string;
  exceptionId?: string;
  entityIds?: string[];
  lastTool?: string;
  playbook?: string;
  resumeAfter?: string;
};

type RunRow = {
  id: string;
  session_id: string;
  command: string;
  intent: string;
  status: AgentRunStatus;
  phase: AgentPhase;
  runtime: AgentRuntimeMode;
  fallback_used: number;
  error: string | null;
  summary: string;
  report: string;
  context: string;
  started_at: string;
  finished_at: string | null;
  cancelled_at: string | null;
};

type SessionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  last_run_id: string | null;
};

export function loadOrCreateSession(db: DatabaseSync, sessionId: string | undefined, now: string): AgentSession {
  if (sessionId) {
    const row = one<SessionRow>(db, "SELECT * FROM agent_sessions WHERE id = ?", [sessionId]);
    if (row) return fromSession(row);
  }
  const session: AgentSession = {
    id: id("ags"),
    createdAt: now,
    updatedAt: now,
    lastRunId: null,
  };
  run(db, "INSERT INTO agent_sessions (id, created_at, updated_at, last_run_id) VALUES (?, ?, ?, ?)", [
    session.id,
    session.createdAt,
    session.updatedAt,
    session.lastRunId,
  ]);
  return session;
}

export function touchSession(db: DatabaseSync, sessionId: string, runId: string, now: string) {
  run(db, "UPDATE agent_sessions SET updated_at = ?, last_run_id = ? WHERE id = ?", [now, runId, sessionId]);
}

export function createRun(
  db: DatabaseSync,
  input: {
    sessionId: string;
    command: string;
    runtime: AgentRuntimeMode;
    now: string;
  },
): AgentRun {
  const runId = id("agr");
  run(
    db,
    `INSERT INTO agent_runs
      (id, session_id, command, intent, status, phase, runtime, fallback_used, error, summary, report, context, started_at, finished_at, cancelled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      input.sessionId,
      input.command,
      "",
      "running",
      "INTERPRETING",
      input.runtime,
      0,
      null,
      "",
      JSON.stringify({ summary: "", intent: "UNKNOWN" }),
      JSON.stringify({}),
      input.now,
      null,
      null,
    ],
  );
  touchSession(db, input.sessionId, runId, input.now);
  return loadRun(db, runId);
}

export function loadRun(db: DatabaseSync, runId: string): AgentRun {
  const row = one<RunRow>(db, "SELECT * FROM agent_runs WHERE id = ?", [runId]);
  if (!row) throw new Error("Agent run not found");
  return {
    id: row.id,
    sessionId: row.session_id,
    command: row.command,
    intent: row.intent,
    status: row.status,
    phase: row.phase,
    runtime: row.runtime,
    fallbackUsed: Boolean(row.fallback_used),
    error: row.error,
    summary: row.summary,
    report: safeJson<AgentRunReport>(row.report, { summary: row.summary, intent: "UNKNOWN" }),
    steps: loadSteps(db, runId),
    toolCalls: loadCalls(db, runId),
    approvals: loadApprovals(db, runId),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    cancelledAt: row.cancelled_at,
  };
}

export function loadRunContext(db: DatabaseSync, runId: string): RunContext {
  const row = one<RunRow>(db, "SELECT context FROM agent_runs WHERE id = ?", [runId]);
  return row ? safeJson<RunContext>(row.context, {}) : {};
}

export function patchRun(
  db: DatabaseSync,
  runId: string,
  patch: {
    intent?: string;
    status?: AgentRunStatus;
    phase?: AgentPhase;
    fallbackUsed?: boolean;
    error?: string | null;
    summary?: string;
    report?: AgentRunReport;
    context?: RunContext;
    finishedAt?: string | null;
    cancelledAt?: string | null;
  },
) {
  const current = one<RunRow>(db, "SELECT * FROM agent_runs WHERE id = ?", [runId]);
  if (!current) throw new Error("Agent run not found");
  const context = patch.context
    ? { ...safeJson<RunContext>(current.context, {}), ...patch.context }
    : safeJson<RunContext>(current.context, {});
  run(
    db,
    `UPDATE agent_runs SET
      intent = ?, status = ?, phase = ?, fallback_used = ?, error = ?, summary = ?, report = ?, context = ?,
      finished_at = ?, cancelled_at = ?
     WHERE id = ?`,
    [
      patch.intent ?? current.intent,
      patch.status ?? current.status,
      patch.phase ?? current.phase,
      patch.fallbackUsed === undefined ? current.fallback_used : patch.fallbackUsed ? 1 : 0,
      patch.error === undefined ? current.error : patch.error,
      patch.summary ?? current.summary,
      JSON.stringify(patch.report ?? safeJson(current.report, { summary: current.summary, intent: "UNKNOWN" })),
      JSON.stringify(context),
      patch.finishedAt === undefined ? current.finished_at : patch.finishedAt,
      patch.cancelledAt === undefined ? current.cancelled_at : patch.cancelledAt,
      runId,
    ],
  );
}

export function appendStep(
  db: DatabaseSync,
  runId: string,
  step: Omit<AgentTraceStep, "id" | "seq"> & { seq?: number },
) {
  const seq = step.seq ?? nextSeq(db, "agent_trace_steps", runId);
  const row: AgentTraceStep = {
    id: id("agt"),
    seq,
    kind: step.kind,
    label: step.label,
    detail: step.detail,
    tool: step.tool,
    toolCallId: step.toolCallId,
    decision: step.decision,
    policy: step.policy,
    createdAt: step.createdAt,
  };
  run(
    db,
    `INSERT INTO agent_trace_steps
      (id, run_id, seq, kind, label, detail, tool, tool_call_id, decision, policy, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      runId,
      row.seq,
      row.kind,
      row.label,
      row.detail,
      row.tool || null,
      row.toolCallId || null,
      row.decision || null,
      row.policy || null,
      row.createdAt,
    ],
  );
  return row;
}

export function appendToolCall(db: DatabaseSync, runId: string, record: Omit<AgentToolCallRecord, "seq"> & { seq?: number }) {
  const seq = record.seq ?? nextSeq(db, "agent_tool_calls", runId);
  run(
    db,
    `INSERT INTO agent_tool_calls
      (id, run_id, seq, tool, permission, arguments, result, status, started_at, finished_at, duration_ms, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      runId,
      seq,
      record.tool,
      record.permission,
      JSON.stringify(record.arguments),
      JSON.stringify(record.result),
      record.status,
      record.startedAt,
      record.finishedAt,
      record.durationMs,
      record.idempotencyKey || null,
    ],
  );
}

export function insertApprovals(db: DatabaseSync, approvals: AgentApproval[]) {
  for (const item of approvals) {
    const existing = one<{ id: string }>(
      db,
      "SELECT id FROM agent_approvals WHERE run_id = ? AND action_id = ?",
      [item.runId, item.actionId],
    );
    if (existing) continue;
    run(
      db,
      `INSERT INTO agent_approvals
        (id, run_id, action_id, plan_id, title, why, impact, policy, evidence, status, created_at, decided_at, decided_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.runId,
        item.actionId,
        item.planId,
        item.title,
        item.why,
        item.impact,
        item.policy,
        item.evidence,
        item.status,
        item.createdAt,
        item.decidedAt,
        item.decidedBy,
      ],
    );
  }
}

export function updateApproval(
  db: DatabaseSync,
  approvalId: string,
  status: AgentApproval["status"],
  now: string,
  actor: string,
) {
  run(db, "UPDATE agent_approvals SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?", [
    status,
    now,
    actor,
    approvalId,
  ]);
}

export function loadIdempotent(db: DatabaseSync, key: string): ToolResult | null {
  const row = one<{ result: string }>(db, "SELECT result FROM agent_idempotency WHERE key = ?", [key]);
  return row ? safeJson<ToolResult>(row.result, null as unknown as ToolResult) : null;
}

export function saveIdempotent(db: DatabaseSync, key: string, runId: string, tool: string, result: ToolResult, now: string) {
  run(
    db,
    "INSERT OR IGNORE INTO agent_idempotency (key, run_id, tool, result, created_at) VALUES (?, ?, ?, ?, ?)",
    [key, runId, tool, JSON.stringify(result), now],
  );
}

function loadSteps(db: DatabaseSync, runId: string): AgentTraceStep[] {
  return all<{
    id: string;
    seq: number;
    kind: AgentTraceStep["kind"];
    label: string;
    detail: string;
    tool: string | null;
    tool_call_id: string | null;
    decision: string | null;
    policy: string | null;
    created_at: string;
  }>(db, "SELECT * FROM agent_trace_steps WHERE run_id = ? ORDER BY seq", [runId]).map((row) => ({
    id: row.id,
    seq: row.seq,
    kind: row.kind,
    label: row.label,
    detail: row.detail,
    tool: row.tool || undefined,
    toolCallId: row.tool_call_id || undefined,
    decision: row.decision || undefined,
    policy: row.policy || undefined,
    createdAt: row.created_at,
  }));
}

function loadCalls(db: DatabaseSync, runId: string): AgentToolCallRecord[] {
  return all<{
    id: string;
    seq: number;
    tool: string;
    permission: AgentToolCallRecord["permission"];
    arguments: string;
    result: string;
    status: ToolResult["status"];
    started_at: string;
    finished_at: string;
    duration_ms: number;
    idempotency_key: string | null;
  }>(db, "SELECT * FROM agent_tool_calls WHERE run_id = ? ORDER BY seq", [runId]).map((row) => ({
    id: row.id,
    seq: row.seq,
    tool: row.tool,
    permission: row.permission,
    arguments: safeJson<Record<string, unknown>>(row.arguments, {}),
    result: safeJson<ToolResult>(row.result, {
      toolCallId: row.id,
      tool: row.tool,
      status: row.status,
      data: {},
      evidence: [],
      policy: null,
      requiresApproval: false,
      links: [],
      generatedAt: row.finished_at,
    }),
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    idempotencyKey: row.idempotency_key || undefined,
  }));
}

function loadApprovals(db: DatabaseSync, runId: string): AgentApproval[] {
  return all<{
    id: string;
    run_id: string;
    action_id: string;
    plan_id: string | null;
    title: string;
    why: string;
    impact: string;
    policy: string;
    evidence: string;
    status: AgentApproval["status"];
    created_at: string;
    decided_at: string | null;
    decided_by: string | null;
  }>(db, "SELECT * FROM agent_approvals WHERE run_id = ? ORDER BY created_at", [runId]).map((row) => ({
    id: row.id,
    runId: row.run_id,
    actionId: row.action_id,
    planId: row.plan_id,
    title: row.title,
    why: row.why,
    impact: row.impact,
    policy: row.policy,
    evidence: row.evidence,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by,
  }));
}

function nextSeq(db: DatabaseSync, table: "agent_trace_steps" | "agent_tool_calls", runId: string) {
  const row = one<{ n: number }>(db, `SELECT COALESCE(MAX(seq), 0) AS n FROM ${table} WHERE run_id = ?`, [runId]);
  return (row?.n || 0) + 1;
}

function fromSession(row: SessionRow): AgentSession {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRunId: row.last_run_id,
  };
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
