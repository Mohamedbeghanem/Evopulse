import type { DatabaseSync } from "node:sqlite";
import { getMeta } from "../db";
import { DeterministicRuntime } from "./deterministic";
import { appendStep, createRun, loadOrCreateSession, loadRun, patchRun } from "./store";
import { applyHumanDecision, finishRun, hostFrom, invokeTool, looksLikeInjection, splitPromptLayers } from "./executor";
import { selectPlaybook } from "./playbooks";
import { resolveConfiguredProvider, type ModelProvider } from "./provider";
import { listBusinessToolSchemas } from "./tools";
import type { AgentRun, AgentRuntime, AgentRunRequest, ApprovalDecision } from "./types";

const cancelled = new Set<string>();

export class DeepSeekHarnessRuntime implements AgentRuntime {
  private readonly fallback: DeterministicRuntime;

  constructor(
    private readonly db: DatabaseSync,
    private readonly options: { provider?: ModelProvider | null; fallback?: DeterministicRuntime } = {},
  ) {
    this.fallback = options.fallback || new DeterministicRuntime(db);
  }

  async run(request: AgentRunRequest): Promise<AgentRun> {
    const provider = this.options.provider === undefined ? resolveConfiguredProvider() : this.options.provider;
    if (!provider || !provider.available()) {
      const run = await this.fallback.run(request);
      return markFallback(this.db, run, "Harness provider unavailable. Deterministic runtime used.");
    }
    const now = request.now || getMeta(this.db, "demo_now") || new Date().toISOString();
    const session = loadOrCreateSession(this.db, request.sessionId, now);
    const created = createRun(this.db, { sessionId: session.id, command: request.command, runtime: "deepseek", now });
    try {
      return await this.loop(created.id, provider, now);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Harness runtime failed.";
      appendStep(this.db, created.id, {
        kind: "fail",
        label: "HARNESS UNAVAILABLE",
        detail: "Deterministic operating path continues.",
        createdAt: now,
      });
      patchRun(this.db, created.id, { fallbackUsed: true, error: message });
      const recovered = await this.fallback.run({ ...request, sessionId: session.id });
      return markFallback(this.db, recovered, message);
    }
  }

  async resume(runId: string): Promise<AgentRun> {
    try {
      const run = loadRun(this.db, runId);
      if (run.runtime !== "deepseek" || run.fallbackUsed) return this.fallback.resume(runId);
      const provider = this.options.provider === undefined ? resolveConfiguredProvider() : this.options.provider;
      if (!provider || !provider.available()) return this.fallback.resume(runId);
      const now = getMeta(this.db, "demo_now") || new Date().toISOString();
      return await this.loop(runId, provider, now);
    } catch {
      return this.fallback.resume(runId);
    }
  }

  cancel(runId: string): AgentRun {
    cancelled.add(runId);
    try {
      return this.fallback.cancel(runId);
    } catch {
      const now = getMeta(this.db, "demo_now") || new Date().toISOString();
      patchRun(this.db, runId, { status: "cancelled", phase: "CANCELLED", cancelledAt: now, finishedAt: now });
      return loadRun(this.db, runId);
    }
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

  private async loop(runId: string, provider: ModelProvider, now: string): Promise<AgentRun> {
    const run = loadRun(this.db, runId);
    const host = hostFrom(this.db, run, now, () => cancelled.has(runId));
    const playbook = selectPlaybook(run.command);
    const layers = splitPromptLayers(run.command, looksLikeInjection(run.command) ? [run.command] : []);
    appendStep(this.db, runId, { kind: "user", label: "UNDERSTANDING REQUEST", detail: run.command, createdAt: now });
    patchRun(this.db, runId, { intent: playbook.intent, context: { playbook: playbook.name } });

    const history: { role: "assistant" | "tool"; tool?: string; content: string }[] = [];
    let safety = 0;
    let modelUsed: string | undefined;
    while (safety < host.limits.maxToolCalls) {
      safety += 1;
      if (cancelled.has(runId)) return loadRun(this.db, runId);
      const response = await provider.complete(
        {
          system: layers.system,
          user: layers.user,
          businessData: layers.businessData,
          tools: listBusinessToolSchemas(),
          history,
        },
        AbortSignal.timeout(8_000),
      );
      if (response.model && response.model !== modelUsed) {
        modelUsed = response.model;
        // Observability only: provider + model id. Never the key or model reasoning.
        console.info(`[agent] run=${runId} provider=${provider.name} model=${modelUsed}`);
      }
      if (response.stop || !response.toolCalls.length) break;
      for (const call of response.toolCalls) {
        const result = await invokeTool(host, call.name, call.arguments || {});
        history.push({ role: "assistant", content: `called ${call.name}` });
        history.push({
          role: "tool",
          tool: call.name,
          content: JSON.stringify({
            tool: result.tool,
            status: result.status,
            data: result.data,
            evidence: result.evidence,
            policy: result.policy,
            requiresApproval: result.requiresApproval,
          }),
        });
        if (result.status === "failed" && result.data.loopLimit) {
          return finishRun(
            host,
            { summary: result.error || "Loop limit", intent: playbook.intent, modelUsed },
            "failed",
            "FAILED",
            result.error,
          );
        }
        if (call.name === "request_action_approval" && result.requiresApproval) {
          return finishRun(
            host,
            {
              summary: "Waiting for your approval.",
              intent: playbook.intent,
              approval: Array.isArray(result.data.approvals) ? result.data.approvals.length : 0,
              modelUsed,
            },
            "waiting_for_approval",
            "WAITING_FOR_APPROVAL",
          );
        }
      }
    }

    const live = loadRun(this.db, runId);
    if (!live.toolCalls.length) {
      patchRun(this.db, runId, { fallbackUsed: true });
      return this.fallback.run({ command: run.command, sessionId: run.sessionId, now });
    }
    return finishRun(
      host,
      {
        summary: live.summary || live.steps.at(-1)?.detail || "Agent run complete.",
        intent: playbook.intent,
        attentionCount: numberFrom(live, "get_attention", "items"),
        associatedRevenue: dataNumber(live, "explain_risk", "associatedRevenue"),
        expectedCash: dataNumber(live, "explain_risk", "expectedCash"),
        orders: dataNumber(live, "explain_risk", "orders"),
        customers: dataNumber(live, "explain_risk", "customers"),
        simulationUnchanged: dataOf(live, "simulate_change")?.realityUnchanged === true,
        executed: arrayLen(live, "execute_safe_actions", "executed"),
        approval: live.approvals.length,
        modelUsed,
      },
      live.approvals.some((item) => item.status === "pending") ? "waiting_for_approval" : "complete",
      live.approvals.some((item) => item.status === "pending") ? "WAITING_FOR_APPROVAL" : "COMPLETE",
    );
  }
}

function markFallback(db: DatabaseSync, run: AgentRun, message: string): AgentRun {
  try {
    patchRun(db, run.id, { fallbackUsed: true, error: run.error || message });
    return { ...loadRun(db, run.id), fallbackUsed: true };
  } catch {
    return { ...run, fallbackUsed: true };
  }
}

function dataOf(run: AgentRun, tool: string) {
  return run.toolCalls.find((call) => call.tool === tool)?.result.data;
}

function dataNumber(run: AgentRun, tool: string, key: string): number | undefined {
  const value = dataOf(run, tool)?.[key];
  return typeof value === "number" ? value : undefined;
}

function numberFrom(run: AgentRun, tool: string, key: string): number | undefined {
  const value = dataOf(run, tool)?.[key];
  return Array.isArray(value) ? value.length : undefined;
}

function arrayLen(run: AgentRun, tool: string, key: string): number | undefined {
  const value = dataOf(run, tool)?.[key];
  return Array.isArray(value) ? value.length : undefined;
}
