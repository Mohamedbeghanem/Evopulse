import { CANONICAL_LIMITS, type AgentModelConfig, type AgentPrivacyConfig, type AgentProviderName } from "./types";

function env(name: string): string {
  return (process.env[name] || "").trim();
}

function csv(name: string): string[] {
  return env(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getRequestedAgentProvider(): AgentProviderName {
  const raw = env("EVOPULSE_AGENT_PROVIDER").toLowerCase();
  return raw === "openrouter" ? "openrouter" : "deterministic";
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(env("OPENROUTER_API_KEY") && env("OPENROUTER_MODEL"));
}

export function resolveAgentProvider(): AgentProviderName {
  const requested = getRequestedAgentProvider();
  if (requested === "openrouter" && isOpenRouterConfigured()) return "openrouter";
  return "deterministic";
}

export function getAgentModelConfig(): AgentModelConfig {
  const primaryModel = env("OPENROUTER_MODEL");
  const fallbackModels = csv("OPENROUTER_FALLBACK_MODEL");
  const timeout = Number(env("EVOPULSE_AGENT_TIMEOUT_MS")) || CANONICAL_LIMITS.executionBudgetMs;
  return {
    provider: resolveAgentProvider(),
    primaryModel,
    fallbackModels,
    timeout: Math.max(1_000, Math.min(timeout, CANONICAL_LIMITS.executionBudgetMs)),
    maxToolCalls: CANONICAL_LIMITS.maxToolCalls,
    maxIdenticalRepeats: CANONICAL_LIMITS.maxIdenticalRepeats,
    maxOutputTokens: Number(env("EVOPULSE_AGENT_MAX_OUTPUT")) || CANONICAL_LIMITS.maxOutputTokens,
    jobRouting: {
      FAST: env("OPENROUTER_FAST_MODEL") || primaryModel || null,
      REASONING: env("OPENROUTER_REASONING_MODEL") || primaryModel || null,
    },
  };
}

export function getAgentPrivacyConfig(): AgentPrivacyConfig {
  const policy = env("OPENROUTER_DATA_POLICY").toLowerCase();
  return {
    approvedProviders: csv("OPENROUTER_ALLOWED_PROVIDERS"),
    dataPolicy: policy === "no_training" || policy === "allowlisted_only" ? policy : "standard",
    allowProviderFallback: env("OPENROUTER_ALLOW_PROVIDER_FALLBACK") !== "false",
  };
}

export function getOpenRouterApiKey(): string {
  return env("OPENROUTER_API_KEY");
}

export function openRouterBaseUrl(): string {
  return env("OPENROUTER_BASE_URL") || "https://openrouter.ai/api/v1";
}
