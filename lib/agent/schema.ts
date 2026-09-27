import { constrainFinancialLanguage } from "./financial";
import type { AgentEvidence, AgentLink, AgentState, AgentStructuredOutput, ToolCallRecord } from "./types";

const UNKNOWN_COPY =
  "EvoPulse does not have enough structured business data to answer that. I will not invent facts, money, policy, or verification.";

export function composeStructuredOutput(input: {
  intent: string;
  summary: string;
  toolCalls: ToolCallRecord[];
  evidence?: AgentEvidence[];
  links?: AgentLink[];
  state: AgentState;
  unknown?: boolean;
}): AgentStructuredOutput {
  return {
    intent: input.intent,
    summary: constrainFinancialLanguage(input.unknown ? UNKNOWN_COPY : input.summary),
    toolCalls: input.toolCalls,
    evidence: input.evidence || collectEvidence(input.toolCalls),
    links: input.links || collectLinks(input.toolCalls),
    state: input.state,
  };
}

export function collectEvidence(toolCalls: ToolCallRecord[]): AgentEvidence[] {
  const evidence: AgentEvidence[] = [];
  for (const call of toolCalls) {
    if (!call.ok || !call.result || typeof call.result !== "object") continue;
    const result = call.result as Record<string, unknown>;
    if (Array.isArray(result.citations)) {
      for (const citation of result.citations as AgentEvidence[]) {
        if (citation?.id) evidence.push(citation);
      }
    }
    if (result.id && result.title) {
      evidence.push({ type: String(result.kind || call.name), id: String(result.id), title: String(result.title) });
    }
  }
  return uniqueEvidence(evidence);
}

export function collectLinks(toolCalls: ToolCallRecord[]): AgentLink[] {
  const links: AgentLink[] = [];
  for (const call of toolCalls) {
    if (!call.ok || !call.result || typeof call.result !== "object") continue;
    const result = call.result as Record<string, unknown>;
    if (typeof result.href === "string") links.push({ href: result.href, label: String(result.title || result.href) });
    const needs = result.needs;
    if (Array.isArray(needs)) {
      for (const item of needs as Array<{ id?: string; href?: string; title?: string }>) {
        if (item.href) links.push({ href: item.href, label: item.title || item.id || item.href });
      }
    }
    if (call.name === "create_goal" && result.goal && typeof result.goal === "object") {
      const goal = result.goal as { id?: string };
      if (goal.id) links.push({ href: `/goals/${goal.id}`, label: "Open the plan / approval handoff" });
    }
    if (call.name === "simulate_change") {
      links.push({ href: "/simulate", label: "Open the simulation chamber" });
    }
  }
  return uniqueLinks(links);
}

export function unknownSummary(): string {
  return UNKNOWN_COPY;
}

function uniqueEvidence(items: AgentEvidence[]): AgentEvidence[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueLinks(items: AgentLink[]): AgentLink[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}
