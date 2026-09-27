import type { DatabaseSync } from "node:sqlite";
import { getMeta } from "../db";
import { evaluatePolicy, loadPolicies } from "../engine/policy";
import type { CommandIntent } from "../command/types";
import { appendStep, createRun, loadOrCreateSession, loadRun, patchRun } from "./store";
import { applyHumanDecision, finishRun, hostFrom, invokeTool, looksLikeInjection } from "./executor";
import { selectPlaybook } from "./playbooks";
import type {
  AgentRun,
  AgentRunReport,
  AgentRuntime,
  AgentRunRequest,
  ApprovalDecision,
} from "./types";

const cancelled = new Set<string>();

export class DeterministicRuntime implements AgentRuntime {
  constructor(private readonly db: DatabaseSync) {}

  async run(request: AgentRunRequest): Promise<AgentRun> {
    const now = request.now || getMeta(this.db, "demo_now") || new Date().toISOString();
    const session = loadOrCreateSession(this.db, request.sessionId, now);
    const created = createRun(this.db, { sessionId: session.id, command: request.command, runtime: "deterministic", now });
    patchRun(this.db, created.id, { context: { playbook: "pending" } });
    return this.execute(created.id, now);
  }

  async resume(runId: string): Promise<AgentRun> {
    const run = loadRun(this.db, runId);
    if (run.status === "cancelled") return run;
    if (run.status === "complete" || run.status === "failed") return run;
    const now = getMeta(this.db, "demo_now") || new Date().toISOString();
    return this.execute(runId, now);
  }

  cancel(runId: string): AgentRun {
    cancelled.add(runId);
    const now = getMeta(this.db, "demo_now") || new Date().toISOString();
    patchRun(this.db, runId, { status: "cancelled", phase: "CANCELLED", cancelledAt: now, finishedAt: now, error: "Cancelled by operator." });
    appendStep(this.db, runId, { kind: "fail", label: "CANCELLED", detail: "Operator cancelled the run.", createdAt: now });
    return loadRun(this.db, runId);
  }

  getStatus(runId: string): AgentRun {
    return loadRun(this.db, runId);
  }

  getTrace(runId: string) {
    return loadRun(this.db, runId).steps;
  }

  requestApproval(runId: string): AgentRun {
    return loadRun(this.db, runId);
  }

  async resumeAfterApproval(runId: string, decision: ApprovalDecision): Promise<AgentRun> {
    const now = getMeta(this.db, "demo_now") || new Date().toISOString();
    return applyHumanDecision(this.db, runId, decision, now);
  }

  private async execute(runId: string, now: string): Promise<AgentRun> {
    const run = loadRun(this.db, runId);
    const host = hostFrom(this.db, run, now, () => cancelled.has(runId));
    const playbook = selectPlaybook(run.command);
    patchRun(this.db, runId, { intent: playbook.intent, context: { playbook: playbook.name } });
    appendStep(this.db, runId, {
      kind: "user",
      label: "UNDERSTANDING REQUEST",
      detail: playbook.name === "injection_guard" ? "Business text treated as data, not instruction." : run.command,
      createdAt: now,
    });

    for (const call of playbook.calls) {
      if (cancelled.has(runId)) return loadRun(this.db, runId);
      const result = await invokeTool(host, call.tool, call.args);
      if (result.status === "failed" && result.data.loopLimit) {
        return finishRun(host, reportFrom(run.command, playbook.intent, loadRun(this.db, runId)), "failed", "FAILED", result.error);
      }
      if (call.tool === "request_action_approval" && result.requiresApproval) {
        const live = loadRun(this.db, runId);
        return finishRun(host, reportFrom(run.command, playbook.intent, live), "waiting_for_approval", "WAITING_FOR_APPROVAL");
      }
    }

    const live = loadRun(this.db, runId);
    const report = reportFrom(run.command, playbook.intent, live);
    if (looksLikeInjection(run.command)) {
      report.summary = "Business text was treated as data. Policy is unchanged.";
    }
    if (playbook.name === "discount_block") {
      const policies = loadPolicies(this.db);
      const decision = evaluatePolicy({ type: "apply_discount", payload: { percent: 10 } }, policies);
      report.policyBlocked = decision.outcome === "BLOCKED";
      report.allowedAlternative = `Policy allows ${policies.discount_max || 5}% or Net-14. 10% stays blocked.`;
      report.summary = decision.reason;
      appendStep(this.db, runId, {
        kind: "blocked",
        label: "BLOCKED",
        detail: decision.reason,
        createdAt: now,
        policy: decision.reason,
        decision: "BLOCKED",
      });
    }
    return finishRun(host, report, "complete", "COMPLETE");
  }
}

function reportFrom(command: string, intent: CommandIntent | "UNKNOWN", run: AgentRun): AgentRunReport {
  const explain = run.toolCalls.find((call) => call.tool === "explain_risk")?.result.data || {};
  const sim = run.toolCalls.find((call) => call.tool === "simulate_change")?.result.data || {};
  const plan = run.toolCalls.find((call) => call.tool === "evaluate_plan" || call.tool === "generate_plan")?.result.data || {};
  const exec = run.toolCalls.find((call) => call.tool === "execute_safe_actions")?.result.data || {};
  const verify = run.toolCalls.find((call) => call.tool === "get_verification")?.result.data || {};
  const attention = run.toolCalls.find((call) => call.tool === "get_attention")?.result.data || {};
  const items = (attention.items as unknown[] | undefined) || [];
  const safe = Number(plan.safe ?? (plan.AUTO as unknown[] | undefined)?.length ?? 0);
  const approval = Number(plan.approval ?? (plan.APPROVAL_REQUIRED as unknown[] | undefined)?.length ?? run.approvals.length);
  const blocked = Number(plan.blocked ?? (plan.BLOCKED as unknown[] | undefined)?.length ?? 0);
  const executed = Array.isArray(exec.executed) ? exec.executed.length : 0;
  return {
    summary: summarize(intent, { explain, sim, plan, exec, items, command, approval, executed }),
    intent,
    attentionCount: items.length,
    associatedRevenue: numberOr(explain.associatedRevenue),
    expectedCash: numberOr(explain.expectedCash),
    orders: numberOr(explain.orders),
    customers: numberOr(explain.customers),
    simulationUnchanged: sim.realityUnchanged === true,
    safe,
    approval,
    blocked,
    executed,
    verificationPending: Number(verify.pending || 0),
    fallbackUsed: run.fallbackUsed,
  };
}

function summarize(
  intent: string,
  bits: {
    explain: Record<string, unknown>;
    sim: Record<string, unknown>;
    plan: Record<string, unknown>;
    exec: Record<string, unknown>;
    items: unknown[];
    command: string;
    approval: number;
    executed: number;
  },
): string {
  if (intent === "CAUSAL_EXPLANATION") {
    return `Why ${Number(bits.explain.associatedRevenue || 0).toLocaleString("en-US")} is connected to this risk`;
  }
  if (intent === "SIMULATION") return "SIMULATION — NOT REAL BUSINESS STATE";
  if (intent === "GOAL") {
    return [
      bits.items.length ? `${bits.items.length} situations require attention.` : "Business inspected.",
      bits.explain.associatedRevenue ? `${Number(bits.explain.associatedRevenue).toLocaleString("en-US")} DZD associated revenue.` : "",
      bits.executed ? `${bits.executed} safe actions executed.` : "",
      bits.approval ? `${bits.approval} waiting for your approval.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (bits.items.length) return `${bits.items.length} situations require attention.`;
  return bits.command;
}

function numberOr(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
