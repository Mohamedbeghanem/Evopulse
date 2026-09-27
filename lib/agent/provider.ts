import { getAgentModelConfig, isOpenRouterConfigured, resolveAgentProvider } from "./config";
import { OpenRouterProvider } from "./openrouter";
import type { AIProvider, AgentProviderName } from "./types";

export function createAIProvider(name?: AgentProviderName): AIProvider | null {
  const resolved = name || resolveAgentProvider();
  if (resolved === "openrouter" && isOpenRouterConfigured()) {
    return new OpenRouterProvider();
  }
  return null;
}

export function describeActiveProvider() {
  const config = getAgentModelConfig();
  return {
    provider: config.provider,
    primaryModel: config.primaryModel || null,
    fallbackModels: config.fallbackModels,
    timeout: config.timeout,
    maxToolCalls: config.maxToolCalls,
  };
}
