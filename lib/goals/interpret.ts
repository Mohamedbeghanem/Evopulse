import { WEEK_END_ISO } from "../clock";
import type { GoalType } from "../types";
import { GOAL_TYPES, type GoalInput, type InterpretedGoal } from "./types";

const TYPE_ALIASES: Record<string, GoalType> = {
  protect_business: "protect_business",
  protect_revenue: "protect_revenue",
  protect_cash: "protect_cash",
  recover_opportunities: "recover_opportunities",
  protect_customer_commitments: "protect_customer_commitments",
};

export function isGoalCommand(text: string): boolean {
  const q = text.toLowerCase();
  return (
    /protect\s+(everything|this|the\s+business|revenue|cash|customer)/.test(q) ||
    /recover\s+(stalled\s+)?opportunit/.test(q) ||
    /what should we handle first/.test(q) ||
    /prepare everything requiring my approval/.test(q) ||
    /protect everything at risk/.test(q)
  );
}

export function interpretGoal(input: GoalInput): InterpretedGoal {
  const structured = input.goalType ? TYPE_ALIASES[input.goalType] : undefined;
  if (structured) {
    return finalize(structured, input.scope || defaultScope(structured), input, "structured");
  }

  const utterance = (input.utterance || "").toLowerCase();
  if (/protect everything at risk/.test(utterance) || /protect (this week's )?business/.test(utterance)) {
    return finalize("protect_business", input.scope || "this_week", input, "utterance");
  }
  if (/protect this month'?s cash|protect.*cash/.test(utterance)) {
    return finalize("protect_cash", input.scope || "this_month", input, "utterance");
  }
  if (/recover (stalled )?opportunit/.test(utterance)) {
    return finalize("recover_opportunities", input.scope || "open", input, "utterance");
  }
  if (/customer commitment|protect commitments/.test(utterance)) {
    return finalize("protect_customer_commitments", input.scope || "this_week", input, "utterance");
  }
  if (/handle first|requiring my approval/.test(utterance)) {
    return finalize("protect_business", input.scope || "this_week", input, "utterance");
  }
  if (/protect.*revenue/.test(utterance)) {
    return finalize("protect_revenue", input.scope || "this_week", input, "utterance");
  }

  return finalize("protect_business", input.scope || "this_week", input, utterance ? "utterance" : "structured");
}

function defaultScope(type: GoalType): string {
  if (type === "protect_cash") return "this_month";
  if (type === "recover_opportunities") return "open";
  return "this_week";
}

function finalize(
  goalType: GoalType,
  scope: string,
  input: GoalInput,
  source: InterpretedGoal["source"],
): InterpretedGoal {
  const objectives: Record<GoalType, string> = {
    protect_business: "Protect business value and commitments at risk before end of week.",
    protect_revenue: "Protect revenue associated with open opportunities and delayed orders.",
    protect_cash: "Protect expected cash timing for the current period.",
    recover_opportunities: "Recover stalled opportunities that still have a path to close.",
    protect_customer_commitments: "Protect customer commitments that are blocked or at risk.",
  };
  return {
    goalType,
    scope,
    objective: objectives[goalType],
    metric: goalType === "protect_cash" ? "cash_timing" : "associated_business_value",
    target: scope,
    deadline: input.deadline || WEEK_END_ISO,
    constraints: {
      respectPolicies: true,
      ...(input.constraints || {}),
    },
    source,
  };
}

export function knownGoalType(value: string): value is GoalType {
  return (GOAL_TYPES as string[]).includes(value);
}
