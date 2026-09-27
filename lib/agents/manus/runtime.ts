/**
 * ManusRuntime: runs a goal through the OpenManus-native PlanningFlow inside EvoPulse.
 *
 * A Manus run is an ordinary EvoPulse agent run (agent_runs, runtime "manus"): every tool call goes
 * through the governed executor, approvals land in agent_approvals + the canonical actions table,
 * and humans decide them through the normal approve flow (/api/agent/runs/:id/approve, goal page).
 */
import type { DatabaseSync } from "node:sqlite";
import { all, getMeta } from "../../db";
import { finishRun, hostFrom, looksLikeInjection } from "../../agent/executor";
import type { ModelProvider } from "../../agent/provider";
import { appendStep, createRun, loadOrCreateSession, loadRun, loadRunContext, patchRun } from "../../agent/store";
import type { AgentRun, LoopLimits } from "../../agent/types";
import { ManusAgent } from "./agent/manus";
import type { ManusEvent } from "./events";
import { createFlow, FlowType } from "./flow/factory";
import type { FlowOutcome } from "./flow/planning";
import { resolveManusLLM } from "./llm";
import { appendManusEvent, loadManusEvents, type StoredManusEvent } from "./store";
import type { ManusTool, ManusToolKind, ManusToolSource } from "./tool";
import { buildManusToolCollection } from "./tools";
import type { Plan } from "./tools/planning";

export const MANUS_LOOP_LIMITS: LoopLimits = {
  maxToolCalls: 24,
  maxRuntimeMs: 90_000,
  maxRepeatedIdenticalCalls: 2,
};

export type ManusRunRequest = {
  goal: string;
  sessionId?: string;
  now?: string;
  /** Test seam. undefined → OpenRouter when OPENROUTER_API_KEY is set; null → deterministic. */
  provider?: ModelProvider | null;
  env?: NodeJS.ProcessEnv;
  extraTools?: ManusTool[];
  limits?: Partial<LoopLimits>;
  maxStepsPerPlanStep?: number;
};

export type ManusToolInfo = {
  name: string;
  kind: ManusToolKind;
  source: ManusToolSource;
  available: boolean;
  reason: string | null;
};

export type ManusApprovalView = AgentRun["approvals"][number] & { links: { href: string; label: string }[] };

export type ManusRunView = {
  id: string;
  goal: string;
  status: AgentRun["status"];
  summary: string;
  runtime: "openrouter" | "deterministic";
  model: string | null;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  planSource: "model" | "deterministic" | null;
  plan: Plan | null;
  question: string | null;
  events: StoredManusEvent[];
  approvals: ManusApprovalView[];
  startedAt: string;
  finishedAt: string | null;
};

export async function runManusGoal(db: DatabaseSync, request: ManusRunRequest): Promise<ManusRunView> {
  const goal = request.goal.trim().slice(0, 2_000);
  if (!goal) throw new Error("goal is required");
  const now = request.now || getMeta(db, "demo_now") || new Date().toISOString();
  const session = loadOrCreateSession(db, request.sessionId, now);
  const created = createRun(db, { sessionId: session.id, command: goal, runtime: "manus", now });
  const host = hostFrom(db, created, now, () => false, { ...MANUS_LOOP_LIMITS, ...request.limits });

  let seq = 0;
  const record = (event: ManusEvent) => {
    seq += 1;
    appendManusEvent(db, created.id, seq, event, new Date().toISOString());
  };

  const { llm, reason } = resolveManusLLM({ provider: request.provider });
  appendStep(db, created.id, { kind: "user", label: "MANUS GOAL", detail: goal, createdAt: now });
  record({
    kind: "info",
    stepIndex: null,
    agentStep: null,
    payload: { runtime: llm.mode, model: llm.model || null, reason },
  });

  const tools = buildManusToolCollection(db, { env: request.env, extraTools: request.extraTools });
  const agent = new ManusAgent({
    llm,
    tools,
    ctx: { db, host, runId: created.id, now },
    goal,
    // A goal that looks like an instruction override reaches the model only as data.
    businessData: looksLikeInjection(goal) ? [goal] : [],
    maxSteps: request.maxStepsPerPlanStep ?? 8,
    onEvent: record,
  });
  const flow = createFlow(FlowType.PLANNING, { manus: agent }, { llm, planId: `plan_${created.id}`, onEvent: record });

  let outcome: FlowOutcome | null = null;
  let failure: string | null = null;
  try {
    outcome = await flow.execute(goal);
  } catch (error) {
    failure = error instanceof Error ? error.message : "Manus run failed.";
  }

  const fallbackUsed = llm.mode === "deterministic" || agent.fallbackUsed;
  const fallbackReason = agent.fallbackReason || reason;
  const pending = loadRun(db, created.id).approvals.filter((a) => a.status === "pending").length;
  const limitStop = outcome?.steps.some((s) => s.finishReason === "limit") || false;
  const summary = failure ? `Run failed: ${failure}` : outcome!.summary;
  record({
    kind: "info",
    stepIndex: null,
    agentStep: null,
    payload: { final: true, summary, planSource: outcome?.planSource || null, question: outcome?.question || null },
  });
  const status: AgentRun["status"] = failure || limitStop ? "failed" : pending ? "waiting_for_approval" : "complete";
  finishRun(
    host,
    {
      summary,
      intent: (outcome?.intent || "UNKNOWN") as AgentRun["report"]["intent"],
      approval: pending,
      fallbackUsed,
      modelUsed: agent.modelUsed,
    },
    status,
    status === "failed" ? "FAILED" : status === "waiting_for_approval" ? "WAITING_FOR_APPROVAL" : "COMPLETE",
    failure || (limitStop ? "A safety limit stopped the run." : null),
  );
  if (fallbackUsed) patchRun(db, created.id, { fallbackUsed: true });
  return loadManusRun(db, created.id);
}

export function loadManusRun(db: DatabaseSync, runId: string): ManusRunView {
  const run = loadRun(db, runId);
  if (run.runtime !== "manus") throw new Error("Not a Manus run");
  const events = loadManusEvents(db, runId);
  const info = events.find((e) => e.kind === "info" && !e.payload.final)?.payload || {};
  const final = [...events].reverse().find((e) => e.kind === "info" && e.payload.final)?.payload || {};
  const plan = ([...events].reverse().find((e) => e.kind === "plan")?.payload.plan as Plan | undefined) || null;
  const fallback = events.find((e) => e.kind === "fallback");
  const context = loadRunContext(db, runId);
  const model = run.report.modelUsed || null;
  return {
    id: run.id,
    goal: run.command,
    status: run.status,
    summary: run.summary,
    runtime: info.runtime === "openrouter" && !fallback ? "openrouter" : "deterministic",
    model: info.runtime === "openrouter" ? model : null,
    fallbackUsed: run.fallbackUsed,
    fallbackReason: (fallback?.payload.reason as string) || (info.reason as string) || null,
    planSource: (final.planSource as ManusRunView["planSource"]) || null,
    plan,
    question: (final.question as string) || null,
    events,
    approvals: run.approvals.map((approval) => ({ ...approval, links: approvalLinks(db, approval.actionId, context.goalId) })),
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

function approvalLinks(db: DatabaseSync, actionId: string, goalId?: string): { href: string; label: string }[] {
  const row = all<{ goal_id: string | null; type: string }>(
    db,
    "SELECT p.goal_id AS goal_id, a.type AS type FROM actions a LEFT JOIN plans p ON p.id = a.plan_id WHERE a.id = ?",
    [actionId],
  )[0];
  const links: { href: string; label: string }[] = [];
  const goal = row?.goal_id || goalId;
  if (goal) links.push({ href: `/goals/${goal}`, label: "Review in the goal plan" });
  if (row?.type === "connector_write") links.push({ href: "/connectors", label: "Open connectors" });
  links.push({ href: "/approvals", label: "All approvals" });
  return links;
}

export function listManusRuns(db: DatabaseSync, limit = 10): { id: string; goal: string; status: string; startedAt: string }[] {
  return all<{ id: string; command: string; status: string; started_at: string }>(
    db,
    "SELECT id, command, status, started_at FROM agent_runs WHERE runtime = 'manus' ORDER BY started_at DESC, rowid DESC LIMIT ?",
    [limit],
  ).map((row) => ({ id: row.id, goal: row.command, status: row.status, startedAt: row.started_at }));
}

export function describeManusTools(db: DatabaseSync, env: NodeJS.ProcessEnv = process.env): ManusToolInfo[] {
  return buildManusToolCollection(db, { env })
    .all()
    .map((tool) => ({
      name: tool.name,
      kind: tool.kind,
      source: tool.source,
      available: tool.available,
      reason: tool.unavailableReason || null,
    }));
}
