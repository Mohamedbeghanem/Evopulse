/**
 * The Manus LLM seam (OpenManus `app/llm.py` → `ask_tool`), EvoPulse-native.
 *
 * There is NO second LLM client here. The only model path is the existing OpenRouter gateway
 * (`createOpenRouterProvider`, PR #55 free-model policy: nvidia/nemotron-3-super-120b-a12b:free,
 * free fallbacks, paid ids refused unless OPENROUTER_ALLOW_PAID=true). Anything else — no key,
 * another provider, a provider error — lands on the deterministic runtime.
 */
import { randomUUID } from "node:crypto";
import { createOpenRouterProvider } from "../../agent/openrouter";
import type { ModelProvider, ProviderRequest } from "../../agent/provider";
import type { PlannedCall } from "../../agent/playbooks";
import { callsForStepText, deterministicPlan, type PlanDraft } from "./deterministic";
import { PLANNING_SYSTEM_PROMPT } from "./prompts";
import type { Message, ToolCall } from "./schema";
import type { ManusToolSpec } from "./tool";
import { TERMINATE } from "./tools/control";
import { PLANNING } from "./tools/planning";

export type ThinkRequest = {
  system: string;
  goal: string;
  stepPrompt: string;
  /** Messages of the current agent run (assistant + tool). */
  messages: Message[];
  tools: ManusToolSpec[];
  /** Untrusted text that must reach the model as data (e.g. a goal that looks like an injection). */
  businessData: string[];
  /** Deterministic runtime only: the tool calls planned for this step. */
  plannedCalls?: PlannedCall[];
  stepText?: string;
};

export type ThinkResponse = { content: string; toolCalls: ToolCall[]; model?: string };

export interface ManusLLM {
  readonly mode: "openrouter" | "deterministic";
  readonly model?: string;
  askTool(request: ThinkRequest): Promise<ThinkResponse>;
  createPlan(goal: string, tools: ManusToolSpec[]): Promise<PlanDraft>;
}

const callId = () => `call_${randomUUID().slice(0, 12)}`;

export class DeterministicManusLLM implements ManusLLM {
  readonly mode = "deterministic" as const;

  async createPlan(goal: string): Promise<PlanDraft> {
    return deterministicPlan(goal);
  }

  async askTool(request: ThinkRequest): Promise<ThinkResponse> {
    const planned = request.plannedCalls ?? callsForStepText(request.stepText || "", request.goal);
    const available = new Set(request.tools.map((tool) => tool.name));
    const done = request.messages.filter((m) => m.role === "tool" && m.name !== TERMINATE).length;
    const toolMessages = request.messages.filter((m) => m.role === "tool");
    const last = toolMessages.at(-1);
    if (last && /"loopLimit":true|limit reached/i.test(last.content)) {
      return { content: "A safety limit stopped the last call. Ending this step.", toolCalls: [terminate("failure")] };
    }
    const remaining = planned.slice(done).filter((call) => available.has(call.tool));
    const next = remaining[0];
    if (!next) {
      return {
        content: planned.length ? "This step's tool work is done." : "No EvoPulse tool matches this step; ending it.",
        toolCalls: [terminate(planned.length ? "success" : "failure")],
      };
    }
    return {
      content: `Next, ${next.tool.replace(/_/g, " ")}.`,
      toolCalls: [{ id: callId(), name: next.tool, arguments: next.args }],
    };
  }
}

function terminate(status: "success" | "failure"): ToolCall {
  return { id: callId(), name: TERMINATE, arguments: { status } };
}

/** Wraps the existing OpenRouter ModelProvider. Refuses any provider not named "openrouter". */
export class OpenRouterManusLLM implements ManusLLM {
  readonly mode = "openrouter" as const;

  constructor(
    private readonly provider: ModelProvider,
    private readonly timeoutMs = 15_000,
  ) {
    if (provider.name !== "openrouter") throw new Error(`Manus only uses the OpenRouter gateway (got ${provider.name}).`);
  }

  get model() {
    return this.provider.model;
  }

  async askTool(request: ThinkRequest): Promise<ThinkResponse> {
    const response = await this.provider.complete(
      {
        system: `${request.system}\n\nTOOLS:\n${describeTools(request.tools)}`,
        user: `USER GOAL: ${request.goal}\n\n${request.stepPrompt}`,
        businessData: request.businessData,
        tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description })),
        history: toHistory(request.messages),
      },
      AbortSignal.timeout(this.timeoutMs),
    );
    return {
      content: String(response.note || (response.toolCalls.length ? "" : "Step complete.")).slice(0, 600),
      // Unknown names are kept so the refusal is visible in the trace; ToolCollection refuses them.
      toolCalls: response.toolCalls.slice(0, 4).map((call) => ({
        id: callId(),
        name: String(call.name || ""),
        arguments: call.arguments && typeof call.arguments === "object" ? call.arguments : {},
      })),
      model: response.model,
    };
  }

  async createPlan(goal: string, tools: ManusToolSpec[]): Promise<PlanDraft> {
    const request: ProviderRequest = {
      system: `${PLANNING_SYSTEM_PROMPT}\n\nEVOPULSE TOOLS THE STEPS CAN USE:\n${describeTools(tools)}`,
      user: `Create a plan for this goal: ${goal}`,
      businessData: [],
      tools: [{ name: PLANNING, description: "Create a plan: arguments {command:'create', title, steps:[string]}" }],
      history: [],
    };
    const response = await this.provider.complete(request, AbortSignal.timeout(this.timeoutMs));
    const call = response.toolCalls.find((item) => item.name === PLANNING);
    const steps = Array.isArray(call?.arguments?.steps)
      ? (call!.arguments.steps as unknown[]).map((s) => String(s ?? "").trim().slice(0, 200)).filter(Boolean).slice(0, 6)
      : [];
    if (!steps.length) throw new Error("Model returned no plan.");
    const fallback = deterministicPlan(goal);
    return {
      title: String(call?.arguments?.title || fallback.title).slice(0, 120),
      steps: steps.map((text) => ({ text })),
      source: "model",
      intent: fallback.intent,
    };
  }
}

function describeTools(tools: ManusToolSpec[]): string {
  return tools
    .map((tool) => {
      const params = Object.entries(tool.parameters)
        .map(([key, p]) => `${key}${p.required ? "*" : ""}:${p.type}`)
        .join(", ");
      return `- ${tool.name}(${params}): ${tool.description.slice(0, 300)}`;
    })
    .join("\n");
}

function toHistory(messages: Message[]): ProviderRequest["history"] {
  return messages
    .filter((m) => m.role === "assistant" || m.role === "tool")
    .slice(-16)
    .map((m) =>
      m.role === "tool"
        ? { role: "tool" as const, tool: m.name, content: m.content.slice(0, 4_000) }
        : {
            role: "assistant" as const,
            content: [m.content, ...(m.toolCalls || []).map((c) => `called ${c.name} ${JSON.stringify(c.arguments)}`)].filter(Boolean).join("\n"),
          },
    );
}

export type ResolvedManusLLM = {
  llm: ManusLLM;
  /** Why the deterministic runtime is used, when it is. */
  reason: string | null;
};

/**
 * Resolve the Manus model path. `provider` may be injected (tests); otherwise the OpenRouter gateway
 * is used when OPENROUTER_API_KEY is set. DeepSeek / Groq / OpenAI keys are NOT used by Manus.
 */
export function resolveManusLLM(options: { provider?: ModelProvider | null } = {}): ResolvedManusLLM {
  let provider = options.provider;
  if (provider === undefined) {
    provider = (process.env.OPENROUTER_API_KEY || "").trim() ? createOpenRouterProvider() : null;
  }
  if (!provider) return { llm: new DeterministicManusLLM(), reason: "OpenRouter is not configured. Deterministic runtime used." };
  if (provider.name !== "openrouter") {
    return { llm: new DeterministicManusLLM(), reason: `Provider ${provider.name} refused: Manus only uses the OpenRouter gateway.` };
  }
  if (!provider.available()) return { llm: new DeterministicManusLLM(), reason: "OpenRouter key missing. Deterministic runtime used." };
  return { llm: new OpenRouterManusLLM(provider), reason: null };
}
