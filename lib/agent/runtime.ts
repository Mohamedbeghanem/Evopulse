import type { DatabaseSync } from "node:sqlite";
import { DeepSeekHarnessRuntime } from "./deepseek";
import { DeterministicRuntime } from "./deterministic";
import type { ModelProvider } from "./provider";
import type { AgentRuntime, AgentRuntimeMode } from "./types";

export function resolveRuntimeMode(explicit?: string): AgentRuntimeMode {
  const raw = (explicit || process.env.EVOPULSE_AGENT_RUNTIME || "deterministic").toLowerCase();
  return raw === "deepseek" ? "deepseek" : "deterministic";
}

export function getAgentRuntime(
  db: DatabaseSync,
  options: { mode?: AgentRuntimeMode | string; provider?: ModelProvider | null } = {},
): AgentRuntime {
  const mode = resolveRuntimeMode(options.mode);
  if (mode === "deepseek") {
    return new DeepSeekHarnessRuntime(db, { provider: options.provider });
  }
  return new DeterministicRuntime(db);
}

export function safeAgentRuntime(
  db: DatabaseSync,
  options: { mode?: AgentRuntimeMode | string; provider?: ModelProvider | null } = {},
): AgentRuntime {
  try {
    return getAgentRuntime(db, options);
  } catch {
    return new DeterministicRuntime(db);
  }
}
