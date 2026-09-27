export type CommandIntent =
  | "ask"
  | "goal"
  | "simulate"
  | "safe_execute"
  | "discount"
  | "protect_safe"
  | "unknown";

export const COMMAND_PROMPTS = [
  "What changed today?",
  "What needs me?",
  "What are you monitoring?",
  "What am I about to miss?",
  "Why is 850K at risk?",
  "What if Atlas another 3 days late?",
  "Protect everything at risk this week.",
  "What can you handle safely?",
  "Fix everything authorized.",
  "What did we do last time?",
  "Why did you block 10%?",
  "10% discount scenario.",
] as const;

export function classifyCommand(text: string): CommandIntent {
  const q = text.toLowerCase().trim();
  if (!q) return "unknown";
  if (/what if|another 3 days|simulate/.test(q)) return "simulate";
  if (/10\s*%|discount scenario/.test(q)) return "discount";
  if (/fix everything authorized|execute (safe|authorized)|handle safely and execute/.test(q)) {
    return "safe_execute";
  }
  if (/what can you handle safely|what can (you|we) (do|handle) safely/.test(q)) return "protect_safe";
  if (
    /protect\s+(everything|this|the\s+business|revenue|cash|customer)/.test(q) ||
    /recover\s+(stalled\s+)?opportunit/.test(q) ||
    /what should we handle first/.test(q) ||
    /prepare everything requiring my approval/.test(q)
  ) {
    return "goal";
  }
  if (
    /what (changed|needs|requires|are you monitoring|am i about to miss|did we do last)|why (is|did you block)|promises|revenue|attention|850|320|atlas|shipment|cash|monitor|miss|last time/.test(
      q,
    )
  ) {
    return "ask";
  }
  return "unknown";
}

export const AGENT_TRACE_STEPS = [
  "Inspecting business",
  "Tracing dependencies",
  "Assessing impact",
  "Simulating",
  "Building plan",
  "Checking policy",
  "Executing safe action",
  "Waiting for approval",
  "Verifying",
] as const;

export function traceForIntent(intent: CommandIntent): string[] {
  switch (intent) {
    case "simulate":
      return ["Inspecting business", "Tracing dependencies", "Simulating"];
    case "goal":
      return ["Inspecting business", "Tracing dependencies", "Assessing impact", "Building plan", "Checking policy", "Waiting for approval"];
    case "safe_execute":
      return ["Inspecting business", "Building plan", "Checking policy", "Executing safe action", "Waiting for approval"];
    case "protect_safe":
      return ["Inspecting business", "Building plan", "Checking policy"];
    case "discount":
      return ["Inspecting business", "Checking policy"];
    case "ask":
      return ["Inspecting business", "Tracing dependencies", "Assessing impact"];
    default:
      return ["Inspecting business"];
  }
}
