import type { DatabaseSync } from "node:sqlite";
import { getMeta } from "../db";
import { getAgentModelConfig, getRequestedAgentProvider } from "./config";
import { runDeterministicTurn } from "./deterministic";
import { constrainFinancialLanguage } from "./financial";
import { OpenRouterError } from "./openrouter";
import { composeStructuredOutput, unknownSummary } from "./schema";
import { persistAgentRun, newAgentRunId } from "./store";
import { AGENT_SYSTEM_PROMPT } from "./system-prompt";
import { executeGovernedTool, GOVERNED_TOOLS } from "./tools";
import type {
  AIProvider,
  AgentProviderName,
  AgentRunOptions,
  AgentRunResult,
  AgentState,
  ChatMessage,
  ProductEvent,
  ToolCallRecord,
} from "./types";

const IN_FLIGHT = new Map<string, AbortController>();

export function cancelAgentRun(runId: string): boolean {
  const controller = IN_FLIGHT.get(runId);
  if (!controller) return false;
  controller.abort();
  return true;
}

export async function runAgent(db: DatabaseSync, command: string, options: AgentRunOptions = {}): Promise<AgentRunResult> {
  const started = Date.now();
  const runId = newAgentRunId();
  const config = getAgentModelConfig();
  const requested = options.forceProvider || getRequestedAgentProvider();
  const events: ProductEvent[] = [];
  const localAbort = new AbortController();
  IN_FLIGHT.set(runId, localAbort);
  const onParentAbort = () => localAbort.abort();
  options.signal?.addEventListener("abort", onParentAbort, { once: true });

  const push = (label: string) => events.push({ label, at: new Date().toISOString() });
  let state: AgentState = "INTERPRETING";

  const finish = (
    partial: Omit<AgentRunResult, "id" | "command" | "durationMs" | "events"> & { events?: ProductEvent[] },
  ): AgentRunResult => {
    const result: AgentRunResult = {
      ...partial,
      id: runId,
      command,
      durationMs: Date.now() - started,
      events: partial.events || events,
    };
    if (options.persist !== false) {
      try {
        persistAgentRun(db, result);
      } catch {
        /* observability must not break the command */
      }
    }
    IN_FLIGHT.delete(runId);
    options.signal?.removeEventListener("abort", onParentAbort);
    return result;
  };

  const cancelled = () => options.signal?.aborted || localAbort.signal.aborted;

  try {
    if (cancelled()) {
      return finish(cancelledResult(requested, config.provider, "User cancelled."));
    }

    if (options.provider && requested === "openrouter") {
      try {
        push("Inspecting business…");
        state = "RUNNING";
        const modelResult = await runModelLoop(db, command, options.provider, localAbort.signal, push, () => state);
        if (cancelled()) {
          return finish(cancelledResult(requested, "openrouter", "User cancelled.", modelResult.toolCalls));
        }
        return finish({
          ...modelResult.output,
          summary: constrainFinancialLanguage(modelResult.output.summary),
          grounded: !modelResult.unknown,
          unknown: modelResult.unknown,
          fallbackUsed: false,
          fallbackReason: null,
          provider: "openrouter",
          requestedProvider: requested,
          model: modelResult.model,
          payload: modelResult.payload,
          error: null,
        });
      } catch (error) {
        if (cancelled()) {
          return finish(cancelledResult(requested, "openrouter", "User cancelled."));
        }
        const reason = error instanceof OpenRouterError ? error.message : "OpenRouter failed.";
        push("Checking policy…");
        const fallback = runDeterministicTurn(db, command);
        return finish({
          ...fallback.output,
          grounded: !fallback.unknown,
          unknown: fallback.unknown,
          fallbackUsed: true,
          fallbackReason: reason,
          provider: "deterministic",
          requestedProvider: requested,
          model: null,
          payload: fallback.payload,
          error: null,
          events: [...events, ...fallback.events],
        });
      }
    }

    const deterministic = runDeterministicTurn(db, command);
    if (cancelled()) {
      return finish(cancelledResult(requested, "deterministic", "User cancelled.", deterministic.output.toolCalls));
    }
    return finish({
      ...deterministic.output,
      grounded: !deterministic.unknown,
      unknown: deterministic.unknown,
      fallbackUsed: requested === "openrouter",
      fallbackReason: requested === "openrouter" ? "OpenRouter is not configured; using deterministic runtime." : null,
      provider: "deterministic",
      requestedProvider: requested,
      model: null,
      payload: deterministic.payload,
      error: null,
      events: deterministic.events,
    });
  } catch (error) {
    if (cancelled()) {
      return finish(cancelledResult(requested, config.provider, "User cancelled."));
    }
    const fallback = runDeterministicTurn(db, command);
    return finish({
      ...fallback.output,
      grounded: !fallback.unknown,
      unknown: fallback.unknown,
      fallbackUsed: true,
      fallbackReason: error instanceof Error ? error.message : "Agent runtime failed.",
      provider: "deterministic",
      requestedProvider: requested,
      model: null,
      payload: fallback.payload,
      error: null,
      events: [...events, ...fallback.events],
    });
  } finally {
    IN_FLIGHT.delete(runId);
    void getMeta(db, "demo_now");
  }
}

async function runModelLoop(
  db: DatabaseSync,
  command: string,
  provider: AIProvider,
  signal: AbortSignal,
  push: (label: string) => void,
  _state: () => AgentState,
): Promise<{
  output: ReturnType<typeof composeStructuredOutput>;
  payload: Record<string, unknown>;
  unknown: boolean;
  model: string | null;
  toolCalls: ToolCallRecord[];
}> {
  const config = getAgentModelConfig();
  const deadline = Date.now() + config.timeout;
  const messages: ChatMessage[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: command },
  ];
  const toolCalls: ToolCallRecord[] = [];
  const repeats = new Map<string, number>();
  let model: string | null = null;
  let finalText = "";
  let turns = 0;

  while (turns < config.maxToolCalls + 1) {
    if (signal.aborted) throw new OpenRouterError("cancelled", "cancelled");
    if (Date.now() > deadline) throw new OpenRouterError("OpenRouter timed out.", "timeout");

    const generated = await provider.generate({
      messages,
      tools: GOVERNED_TOOLS,
      timeoutMs: Math.max(500, deadline - Date.now()),
      maxOutputTokens: config.maxOutputTokens,
      signal,
      job: turns === 0 ? "FAST" : "REASONING",
    });
    model = generated.model;
    turns += 1;

    if (!generated.toolCalls.length) {
      finalText = generated.content || "";
      break;
    }

    messages.push({
      role: "assistant",
      content: generated.content || "",
      toolCalls: generated.toolCalls,
    });

    for (const call of generated.toolCalls) {
      if (signal.aborted) throw new OpenRouterError("cancelled", "cancelled");
      if (toolCalls.length >= config.maxToolCalls) {
        toolCalls.push({
          id: call.id,
          name: call.name,
          category: "UNKNOWN",
          arguments: call.arguments,
          ok: false,
          forbidden: false,
          result: null,
          error: `Tool-call limit ${config.maxToolCalls} reached.`,
        });
        finalText = composeFromTools(command, toolCalls);
        return pack(command, toolCalls, finalText, model);
      }

      const fingerprint = `${call.name}:${stableArgs(call.arguments)}`;
      const seen = (repeats.get(fingerprint) || 0) + 1;
      repeats.set(fingerprint, seen);
      if (seen > config.maxIdenticalRepeats) {
        toolCalls.push({
          id: call.id,
          name: call.name,
          category: "READ",
          arguments: call.arguments,
          ok: false,
          forbidden: false,
          result: null,
          error: `Repeat-call limit ${config.maxIdenticalRepeats} reached for ${call.name}.`,
        });
        messages.push({
          role: "tool",
          name: call.name,
          toolCallId: call.id,
          content: JSON.stringify({ error: "repeat_call_limit" }),
        });
        continue;
      }

      push(productEventFor(call.name));
      const executed = executeGovernedTool(db, call.name, call.arguments || {}, call.id);
      toolCalls.push(executed);
      messages.push({
        role: "tool",
        name: call.name,
        toolCallId: call.id,
        content: JSON.stringify(executed.ok ? executed.result : { error: executed.error, forbidden: executed.forbidden }),
      });
    }
  }

  if (!finalText) finalText = composeFromTools(command, toolCalls);
  return pack(command, toolCalls, finalText, model);
}

function pack(command: string, toolCalls: ToolCallRecord[], summary: string, model: string | null) {
  const unknown = !toolCalls.some((call) => call.ok) && /enough structured business data|do not have/i.test(summary);
  const waiting = toolCalls.some((call) => call.name === "request_action_approval" && call.ok);
  const verifying = toolCalls.some((call) => call.name === "get_verification" && call.ok);
  return {
    output: composeStructuredOutput({
      intent: inferIntent(command, toolCalls),
      summary: constrainFinancialLanguage(summary || unknownSummary()),
      toolCalls,
      state: waiting ? "WAITING_FOR_APPROVAL" : verifying ? "VERIFYING" : "COMPLETE",
      unknown,
    }),
    payload: { toolResults: toolCalls.map((call) => ({ name: call.name, ok: call.ok })) },
    unknown,
    model,
    toolCalls,
  };
}

function composeFromTools(command: string, toolCalls: ToolCallRecord[]): string {
  const risk = toolCalls.find((call) => call.name === "explain_risk" && call.ok)?.result as
    | { associatedRevenue?: number; expectedCashTiming?: number; affectedOrders?: unknown[]; affectedCustomers?: unknown[]; groundedAnswer?: string }
    | undefined;
  if (risk?.associatedRevenue != null) {
    return `${risk.affectedOrders?.length || 0} orders and ${risk.affectedCustomers?.length || 0} customers. ${risk.associatedRevenue.toLocaleString("en-US")} DZD associated revenue. ${Number(risk.expectedCashTiming || 0).toLocaleString("en-US")} DZD expected cash timing. Not lost.`;
  }
  const sim = toolCalls.find((call) => call.name === "simulate_change" && call.ok)?.result as
    | { delta?: { headline?: string[] }; isolation?: { unchanged?: boolean } }
    | undefined;
  if (sim?.delta?.headline) {
    return `${sim.delta.headline.join(" ")} Isolation ${sim.isolation?.unchanged ? "verified" : "failed"}. Reality is unchanged.`;
  }
  const policy = toolCalls.find((call) => call.name === "get_policy" && call.ok)?.result as
    | { live?: { outcome?: string; reason?: string } }
    | undefined;
  if (policy?.live?.outcome === "BLOCKED") {
    return `BLOCKED. ${policy.live.reason || "Policy refused the request."} The model cannot override it.`;
  }
  const goal = toolCalls.find((call) => call.name === "create_goal" && call.ok)?.result as { goal?: { objective?: string } } | undefined;
  if (goal?.goal?.objective) return `${goal.goal.objective} Plan prepared. Humans approve consequential actions.`;
  if (/unknown|invent|xyz|asdf|random/.test(command.toLowerCase())) return unknownSummary();
  return unknownSummary();
}

function inferIntent(command: string, toolCalls: ToolCallRecord[]): string {
  if (toolCalls.some((call) => call.name === "simulate_change")) return "simulate";
  if (toolCalls.some((call) => call.name === "create_goal" || call.name === "execute_safe_actions")) return "goal";
  if (toolCalls.some((call) => call.name === "get_policy")) return "discount";
  if (toolCalls.some((call) => call.name === "explain_risk" || call.name === "get_attention")) return "ask";
  return command.trim() ? "ask" : "unknown";
}

function productEventFor(name: string): string {
  const labels: Record<string, string> = {
    get_business_state: "Inspecting business…",
    get_recent_changes: "Inspecting business…",
    get_attention: "Inspecting business…",
    get_upcoming_risks: "Tracing dependencies…",
    explain_risk: "Assessing impact…",
    simulate_change: "Simulating…",
    create_goal: "Preparing recovery…",
    generate_plan: "Building plan…",
    evaluate_plan: "Building plan…",
    get_policy: "Checking policy…",
    get_safe_actions: "Checking policy…",
    execute_safe_actions: "Executing safe action…",
    request_action_approval: "Waiting for approval…",
    get_verification: "Verifying…",
  };
  return labels[name] || "Inspecting business…";
}

function cancelledResult(
  requested: AgentProviderName,
  provider: AgentProviderName,
  message: string,
  toolCalls: ToolCallRecord[] = [],
): Omit<AgentRunResult, "id" | "command" | "durationMs" | "events"> {
  return {
    intent: "cancelled",
    summary: "Command cancelled.",
    toolCalls,
    evidence: [],
    links: [],
    state: "CANCELLED",
    grounded: false,
    unknown: false,
    fallbackUsed: false,
    fallbackReason: null,
    provider,
    requestedProvider: requested,
    model: null,
    payload: {},
    error: message,
  };
}

function stableArgs(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args, Object.keys(args).sort());
  } catch {
    return "";
  }
}

export function isRunActive(runId: string): boolean {
  return IN_FLIGHT.has(runId);
}
