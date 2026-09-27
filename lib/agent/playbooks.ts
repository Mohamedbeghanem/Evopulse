import type { DatabaseSync } from "node:sqlite";
import { CommandRouter, normalize } from "../command/router";
import type { CommandIntent } from "../command/types";
import { IDS } from "../ids";
import { looksLikeInjection } from "./executor";

export type PlannedCall = { tool: string; args: Record<string, unknown> };

export type Playbook = {
  name: string;
  intent: CommandIntent | "UNKNOWN";
  calls: PlannedCall[];
};

export function selectPlaybook(command: string): Playbook {
  const q = normalize(command);
  const router = new CommandRouter(null as unknown as DatabaseSync);
  const intent = classifyAgentIntent(q, router.classifyIntent(command));

  if (looksLikeInjection(command)) {
    return {
      name: "injection_guard",
      intent: "POLICY",
      calls: [{ tool: "get_policy", args: {} }],
    };
  }

  if (isDiscountAsk(q)) {
    return {
      name: "discount_block",
      intent: "POLICY",
      calls: [
        { tool: "get_policy", args: {} },
        { tool: "get_safe_actions", args: {} },
      ],
    };
  }

  if (intent === "BUSINESS_CHANGES") {
    return { name: "changes", intent, calls: [{ tool: "get_recent_changes", args: { timeRange: "today" } }] };
  }
  if (intent === "ATTENTION") {
    return { name: "attention", intent, calls: [{ tool: "get_attention", args: {} }] };
  }
  if (intent === "FUTURE_RISK") {
    return { name: "future_risk", intent, calls: [{ tool: "get_upcoming_risks", args: {} }] };
  }
  if (intent === "CAUSAL_EXPLANATION" || intent === "IMPACT") {
    return {
      name: "explain_risk",
      intent: "CAUSAL_EXPLANATION",
      calls: [{ tool: "explain_risk", args: { entityId: IDS.shipment } }],
    };
  }
  if (intent === "SIMULATION") {
    const days = Number((q.match(/(\d+)\s*days?/) || [])[1] || 3);
    return {
      name: "simulate",
      intent,
      calls: [{ tool: "simulate_change", args: { entity: "Atlas Supply", change: "supplier_delay", days } }],
    };
  }
  if (intent === "GOAL") {
    return {
      name: "protect",
      intent,
      calls: [
        { tool: "get_attention", args: {} },
        { tool: "explain_risk", args: { entityId: IDS.shipment } },
        { tool: "simulate_change", args: { entity: IDS.shipment, change: "supplier_delay", days: 3 } },
        { tool: "create_goal", args: { utterance: command, idempotencyKey: "goal" } },
        { tool: "generate_plan", args: { idempotencyKey: "plan" } },
        { tool: "evaluate_plan", args: {} },
        { tool: "execute_safe_actions", args: { idempotencyKey: "exec" } },
        { tool: "request_action_approval", args: { idempotencyKey: "approve" } },
        { tool: "get_verification", args: {} },
      ],
    };
  }
  if (intent === "PLAN") {
    return { name: "plan", intent, calls: [{ tool: "evaluate_plan", args: {} }] };
  }
  if (intent === "HISTORY") {
    return { name: "history", intent, calls: [{ tool: "get_historical_cases", args: {} }] };
  }
  if (intent === "POLICY") {
    return {
      name: "policy",
      intent,
      calls: [
        { tool: "get_policy", args: {} },
        { tool: "get_safe_actions", args: {} },
      ],
    };
  }
  if (intent === "EXECUTION") {
    return {
      name: "execute",
      intent,
      calls: [
        { tool: "get_safe_actions", args: {} },
        { tool: "execute_safe_actions", args: { idempotencyKey: "exec" } },
        { tool: "get_verification", args: {} },
      ],
    };
  }
  if (intent === "STATUS" && /monitor/.test(q)) {
    return { name: "monitoring", intent, calls: [{ tool: "get_attention", args: {} }] };
  }
  if (intent === "STATUS" && /why did you/.test(q)) {
    return { name: "audit", intent, calls: [{ tool: "get_autopilot_trace", args: {} }, { tool: "get_policy", args: {} }] };
  }
  if (intent === "STATUS") {
    return { name: "state", intent, calls: [{ tool: "get_business_state", args: {} }] };
  }
  if (intent === "AUTOPILOT") {
    return { name: "autopilot", intent, calls: [{ tool: "get_attention", args: {} }] };
  }
  return {
    name: "unknown",
    intent: "UNKNOWN",
    calls: [{ tool: "get_attention", args: {} }],
  };
}

function classifyAgentIntent(q: string, routed: CommandIntent): CommandIntent {
  if (isDiscountAsk(q)) return "POLICY";
  if (/give the customer|issue refunds/.test(q)) return "POLICY";
  return routed;
}

function isDiscountAsk(q: string): boolean {
  return /give .{0,40}10\s*%|10\s*% discount|customer 10/.test(q) && !/why/.test(q);
}
