import { getAgentModelConfig, getAgentPrivacyConfig, getOpenRouterApiKey, openRouterBaseUrl } from "./config";
import type { AIProvider, GenerateRequest, GenerateResult, ToolCallRequest } from "./types";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly code: "timeout" | "http" | "malformed" | "auth" | "cancelled" | "network",
    readonly status?: number,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

type OpenRouterMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const config = getAgentModelConfig();
    const model = request.model || config.primaryModel;
    if (!model) {
      throw new OpenRouterError("OPENROUTER_MODEL is not configured.", "auth");
    }
    try {
      return await this.complete(request, model);
    } catch (error) {
      if (error instanceof OpenRouterError && error.code === "cancelled") throw error;
      const fallback = config.fallbackModels[0];
      if (fallback && fallback !== model && error instanceof OpenRouterError && error.code !== "auth") {
        return this.complete(request, fallback);
      }
      throw error;
    }
  }

  async *stream(request: GenerateRequest): AsyncIterable<GenerateResult> {
    yield this.generate(request);
  }

  private async complete(request: GenerateRequest, model: string): Promise<GenerateResult> {
    const key = getOpenRouterApiKey();
    if (!key) throw new OpenRouterError("OPENROUTER_API_KEY is not configured.", "auth");

    const privacy = getAgentPrivacyConfig();
    const timeoutMs = request.timeoutMs || getAgentModelConfig().timeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
    const onAbort = () => controller.abort("cancelled");
    request.signal?.addEventListener("abort", onAbort, { once: true });

    const body: Record<string, unknown> = {
      model,
      temperature: 0,
      max_tokens: request.maxOutputTokens || getAgentModelConfig().maxOutputTokens,
      messages: toOpenRouterMessages(request),
      tools: request.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
    };

    if (privacy.approvedProviders.length || privacy.dataPolicy !== "standard") {
      body.provider = {
        ...(privacy.approvedProviders.length ? { order: privacy.approvedProviders, allow_fallbacks: privacy.allowProviderFallback } : {}),
        ...(privacy.dataPolicy === "no_training" ? { data_collection: "deny" } : {}),
        ...(privacy.dataPolicy === "allowlisted_only" && privacy.approvedProviders.length
          ? { only: privacy.approvedProviders, allow_fallbacks: false }
          : {}),
      };
    }

    try {
      const response = await this.fetchImpl(`${openRouterBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://evopulse.local",
          "X-Title": "EvoPulse",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new OpenRouterError("OpenRouter rejected the server credential.", "auth", response.status);
      }
      if (!response.ok) {
        throw new OpenRouterError(`OpenRouter HTTP ${response.status}`, "http", response.status);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          finish_reason?: string;
          message?: {
            content?: string | null;
            tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
          };
        }>;
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const choice = data.choices?.[0];
      if (!choice?.message) {
        throw new OpenRouterError("OpenRouter returned a malformed response.", "malformed");
      }
      return {
        content: choice.message.content || "",
        toolCalls: parseToolCalls(choice.message.tool_calls),
        model: data.model || model,
        finishReason: choice.finish_reason || "stop",
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
        },
      };
    } catch (error) {
      if (error instanceof OpenRouterError) throw error;
      if (request.signal?.aborted || controller.signal.aborted) {
        const reason = request.signal?.aborted ? "cancelled" : "timeout";
        throw new OpenRouterError(reason === "cancelled" ? "OpenRouter call cancelled." : "OpenRouter timed out.", reason);
      }
      throw new OpenRouterError("OpenRouter network error.", "network");
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
    }
  }
}

function toOpenRouterMessages(request: GenerateRequest): OpenRouterMessage[] {
  return request.messages.map((message) => {
    if (message.role === "assistant" && message.toolCalls?.length) {
      return {
        role: "assistant",
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        })),
      };
    }
    if (message.role === "tool") {
      return {
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId,
        name: message.name,
      };
    }
    return { role: message.role, content: message.content };
  });
}

export function parseToolCalls(
  raw: Array<{ id?: string; function?: { name?: string; arguments?: string } }> | undefined,
): ToolCallRequest[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => ({
    id: item.id || `call_${index}`,
    name: item.function?.name || "",
    arguments: parseToolArguments(item.function?.arguments),
  }));
}

export function parseToolArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw || !raw.trim()) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return { __malformed: true, raw };
  }
}
