export const AGENT_STATES = [
  "IDLE",
  "INTERPRETING",
  "RUNNING",
  "WAITING_FOR_TOOL",
  "WAITING_FOR_APPROVAL",
  "EXECUTING",
  "VERIFYING",
  "COMPLETE",
  "FAILED",
  "CANCELLED",
] as const;

export type AgentState = (typeof AGENT_STATES)[number];

export const AGENT_PROVIDERS = ["deterministic", "openrouter"] as const;
export type AgentProviderName = (typeof AGENT_PROVIDERS)[number];

export const TOOL_CATEGORIES = ["READ", "PREPARE", "EXECUTE_SAFE", "HUMAN_REQUIRED", "FORBIDDEN"] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const CANONICAL_LIMITS = {
  maxToolCalls: 12,
  executionBudgetMs: 20_000,
  maxIdenticalRepeats: 2,
  maxOutputTokens: 1_200,
  providerTimeoutMs: 8_000,
} as const;

export type AgentModelConfig = {
  provider: AgentProviderName;
  primaryModel: string;
  fallbackModels: string[];
  timeout: number;
  maxToolCalls: number;
  maxIdenticalRepeats: number;
  maxOutputTokens: number;
  jobRouting: {
    FAST: string | null;
    REASONING: string | null;
  };
};

export type AgentPrivacyConfig = {
  approvedProviders: string[];
  dataPolicy: "standard" | "no_training" | "allowlisted_only";
  allowProviderFallback: boolean;
};

export type ToolJsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type GovernedToolDefinition = {
  name: string;
  category: ToolCategory;
  description: string;
  parameters: ToolJsonSchema;
};

export type ToolCallRequest = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolCallRecord = {
  id: string;
  name: string;
  category: ToolCategory | "UNKNOWN";
  arguments: Record<string, unknown>;
  ok: boolean;
  forbidden: boolean;
  result: unknown;
  error?: string;
};

export type AgentEvidence = {
  type: string;
  id: string;
  title: string;
};

export type AgentLink = {
  href: string;
  label: string;
};

export type ProductEvent = {
  label: string;
  at: string;
};

export type AgentStructuredOutput = {
  intent: string;
  summary: string;
  toolCalls: ToolCallRecord[];
  evidence: AgentEvidence[];
  links: AgentLink[];
  state: AgentState;
};

export type AgentRunResult = AgentStructuredOutput & {
  id: string;
  command: string;
  grounded: boolean;
  unknown: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  provider: AgentProviderName;
  requestedProvider: AgentProviderName;
  model: string | null;
  durationMs: number;
  events: ProductEvent[];
  payload: Record<string, unknown>;
  error: string | null;
};

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCallRequest[];
};

export type GenerateRequest = {
  messages: ChatMessage[];
  tools: GovernedToolDefinition[];
  model?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  job?: "FAST" | "REASONING";
};

export type GenerateResult = {
  content: string;
  toolCalls: ToolCallRequest[];
  model: string;
  finishReason: string;
  usage?: { promptTokens?: number; completionTokens?: number };
};

export interface AIProvider {
  readonly name: AgentProviderName | string;
  generate(request: GenerateRequest): Promise<GenerateResult>;
  stream?(request: GenerateRequest): AsyncIterable<GenerateResult>;
}

export type AgentRunOptions = {
  provider?: AIProvider | null;
  forceProvider?: AgentProviderName;
  signal?: AbortSignal;
  now?: string;
  persist?: boolean;
};
