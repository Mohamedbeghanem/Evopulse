import type { DatabaseSync } from "node:sqlite";
import { classifyCommand, type CommandIntent } from "../ui/commands";
import { constrainFinancialLanguage } from "./financial";
import { composeStructuredOutput, unknownSummary } from "./schema";
import { executeGovernedTool } from "./tools";
import type { AgentStructuredOutput, ProductEvent, ToolCallRecord } from "./types";

export function interpretCommand(command: string): CommandIntent {
  return classifyCommand(command);
}

export function runDeterministicTurn(db: DatabaseSync, command: string): {
  output: AgentStructuredOutput;
  events: ProductEvent[];
  payload: Record<string, unknown>;
  unknown: boolean;
} {
  const intent = interpretCommand(command);
  const events: ProductEvent[] = [];
  const toolCalls: ToolCallRecord[] = [];
  const payload: Record<string, unknown> = { intent };
  let call = 0;
  const callTool = (name: string, args: Record<string, unknown> = {}) => {
    events.push(eventForTool(name));
    const record = executeGovernedTool(db, name, args, `det_${++call}`);
    toolCalls.push(record);
    return record;
  };

  if (intent === "simulate") {
    const sim = callTool("simulate_change", { type: "supplier_delay", targetId: "ent_ship_204", days: 3 });
    payload.simulation = sim.result;
    return done("simulate", summarizeSimulation(sim.result), toolCalls, events, payload, false);
  }

  if (intent === "discount") {
    const policy = callTool("get_policy", { type: "apply_discount", payload: { percent: 10 } });
    payload.policy = policy.result;
    const live = (policy.result as { live?: { outcome?: string; reason?: string } } | null)?.live;
    const summary =
      live?.outcome === "BLOCKED"
        ? `BLOCKED. ${live.reason || "Policy discount_max=5% refused 10%."} Safe alternatives remain 5% or Net-14. The model cannot override policy.`
        : "Policy was rechecked against the live discount_max rule.";
    return done("discount", summary, toolCalls, events, payload, false);
  }

  if (intent === "goal" || intent === "protect_safe" || intent === "safe_execute") {
    callTool("get_attention");
    callTool("get_upcoming_risks");
    const created = callTool("create_goal", { utterance: protectUtterance(command), plan: true });
    payload.goal = created.result;
    const planId = planIdFrom(created.result);
    if (planId) {
      callTool("get_policy");
      callTool("evaluate_plan", { planId });
      callTool("get_safe_actions", { planId });
      if (intent === "safe_execute" || intent === "goal") {
        const executed = callTool("execute_safe_actions", { planId });
        payload.safe = executed.result;
      }
      const approval = callTool("request_action_approval", { planId });
      payload.approval = approval.result;
    }
    return done(intent, summarizeProtect(created.result, payload.safe), toolCalls, events, payload, false);
  }

  if (intent === "ask") {
    callTool("get_attention");
    const risk = callTool("explain_risk", { question: command });
    payload.ask = risk.result;
    if (/last time|histor/.test(command.toLowerCase())) {
      payload.history = callTool("get_historical_cases", {}).result;
    }
    if (/monitor/.test(command.toLowerCase())) {
      payload.verification = callTool("get_verification", {}).result;
    }
    return done("ask", summarizeAsk(risk.result, command), toolCalls, events, payload, false);
  }

  callTool("get_business_state");
  return done("unknown", unknownSummary(), toolCalls, events, payload, true);
}

function done(
  intent: string,
  summary: string,
  toolCalls: ToolCallRecord[],
  events: ProductEvent[],
  payload: Record<string, unknown>,
  unknown: boolean,
) {
  return {
    output: composeStructuredOutput({
      intent,
      summary: constrainFinancialLanguage(summary),
      toolCalls,
      state: unknown ? "COMPLETE" : approvalState(toolCalls),
      unknown,
    }),
    events,
    payload,
    unknown,
  };
}

function approvalState(toolCalls: ToolCallRecord[]): AgentStructuredOutput["state"] {
  const approval = toolCalls.find((call) => call.name === "request_action_approval" && call.ok);
  const waiting = (approval?.result as { waiting?: unknown[] } | undefined)?.waiting;
  if (waiting && waiting.length > 0) return "WAITING_FOR_APPROVAL";
  const verify = toolCalls.find((call) => call.name === "get_verification");
  if (verify) return "VERIFYING";
  return "COMPLETE";
}

function eventForTool(name: string): ProductEvent {
  const labels: Record<string, string> = {
    get_business_state: "Inspecting business…",
    get_recent_changes: "Inspecting business…",
    get_attention: "Inspecting business…",
    get_upcoming_risks: "Tracing dependencies…",
    explain_risk: "Assessing impact…",
    get_evidence: "Inspecting business…",
    simulate_change: "Simulating…",
    evaluate_plan: "Building plan…",
    get_safe_actions: "Checking policy…",
    get_verification: "Verifying…",
    get_historical_cases: "Inspecting business…",
    get_policy: "Checking policy…",
    get_autopilot_trace: "Inspecting business…",
    create_goal: "Preparing recovery…",
    generate_plan: "Building plan…",
    execute_safe_actions: "Executing safe action…",
    request_action_approval: "Waiting for approval…",
  };
  return { label: labels[name] || "Inspecting business…", at: new Date().toISOString() };
}

function planIdFrom(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const plan = (result as { plan?: { id?: string } }).plan;
  return plan?.id || null;
}

function protectUtterance(command: string): string {
  return /protect|recover|handle first|approval/.test(command.toLowerCase())
    ? command
    : "Protect everything at risk this week.";
}

function summarizeSimulation(result: unknown): string {
  if (!result || typeof result !== "object") return "Simulation did not return a canonical delta.";
  const delta = (result as { delta?: { headline?: string[]; cash?: { movedToNextPeriod?: number } } }).delta;
  const isolation = (result as { isolation?: { unchanged?: boolean } }).isolation;
  const lines = delta?.headline?.join(" ") || "Canonical simulation produced no headline.";
  const cash = delta?.cash?.movedToNextPeriod;
  return `${lines}${cash != null ? ` Cash moved to next period: ${cash.toLocaleString("en-US")} DZD.` : ""} Isolation ${isolation?.unchanged ? "verified" : "failed"}. Reality is unchanged.`;
}

function summarizeProtect(goalResult: unknown, safe: unknown): string {
  const goal = (goalResult as { goal?: { objective?: string }; plan?: { expectedImpact?: { autoActions?: number; approvalRequiredActions?: number; blockedActions?: number } } }) || {};
  const impact = goal.plan?.expectedImpact;
  const counts = (safe as { counts?: { executed?: number; waitingForApproval?: number; blocked?: number } } | undefined)?.counts;
  const parts = [
    goal.goal?.objective || "Protect everything at risk this week.",
    impact
      ? `${impact.autoActions || 0} AUTO · ${impact.approvalRequiredActions || 0} need approval · ${impact.blockedActions || 0} blocked.`
      : "",
    counts
      ? `Safe execute: ${counts.executed || 0} AUTO ran · ${counts.waitingForApproval || 0} waiting for a human · ${counts.blocked || 0} blocked.`
      : "Consequential actions remain waiting for a human. Blocked actions stay blocked.",
    "The agent did not self-approve. Verification owns resolution.",
  ];
  return parts.filter(Boolean).join(" ");
}

function summarizeAsk(result: unknown, command: string): string {
  if (!result || typeof result !== "object") return unknownSummary();
  const record = result as {
    groundedAnswer?: string;
    associatedRevenue?: number;
    expectedCashTiming?: number;
    affectedOrders?: unknown[];
    affectedCustomers?: unknown[];
    notes?: string;
  };
  if (/850|at risk|atlas|why/.test(command.toLowerCase()) && record.associatedRevenue != null) {
    return `${record.affectedOrders?.length || 0} orders and ${record.affectedCustomers?.length || 0} customers depend on the delayed shipment. ${record.associatedRevenue.toLocaleString("en-US")} DZD associated revenue. ${Number(record.expectedCashTiming || 0).toLocaleString("en-US")} DZD expected cash timing. Not lost. ${record.notes || ""}`.trim();
  }
  return constrainFinancialLanguage(record.groundedAnswer || record.notes || unknownSummary());
}
