/**
 * Deterministic planner + thinker: the no-model path of the Manus port.
 *
 * It reuses the existing deterministic AgentRuntime playbooks (`selectPlaybook`) — the same intent
 * routing EvoPulse already trusts — to split a goal into plan steps and to pick each step's tool
 * calls. It never reads tool output to decide what to do, so injected text cannot steer it.
 */
import { selectPlaybook, type PlannedCall } from "../../agent/playbooks";
import { MANUS_EXCLUDED_CORE_TOOLS } from "./tools/evopulse";

export type PlanDraftStep = { text: string; calls?: PlannedCall[] };
export type PlanDraft = { title: string; steps: PlanDraftStep[]; source: "model" | "deterministic"; intent: string };

const STEP_FOR_TOOL: Record<string, string> = {
  get_attention: "Inspect what needs attention",
  get_business_state: "Inspect the business state",
  get_recent_changes: "Review what changed",
  get_upcoming_risks: "Look ahead at upcoming risks",
  explain_risk: "Trace the risk and its business impact",
  get_evidence: "Collect the evidence",
  simulate_change: "Simulate recovery without touching reality",
  create_goal: "Prepare a governed plan (goal → planner → policy)",
  generate_plan: "Prepare a governed plan (goal → planner → policy)",
  evaluate_plan: "Prepare a governed plan (goal → planner → policy)",
  get_policy: "Check what policy allows",
  get_safe_actions: "Check what policy allows",
  request_action_approval: "Request human approval for consequential actions",
  get_verification: "Check verification status (executed is not handled)",
  get_historical_cases: "Look up similar past cases",
  get_autopilot_trace: "Review the autopilot trace",
};

export function deterministicPlan(goal: string): PlanDraft {
  const playbook = selectPlaybook(goal);
  if (playbook.name === "injection_guard") {
    return {
      title: "Guarded request",
      intent: playbook.intent,
      source: "deterministic",
      steps: [
        {
          text: "Check policy — the goal contains text that tries to override the rules; it is treated as data",
          calls: playbook.calls,
        },
      ],
    };
  }
  const steps: PlanDraftStep[] = [];
  for (const call of playbook.calls) {
    if (MANUS_EXCLUDED_CORE_TOOLS.has(call.tool)) continue; // a Manus run executes nothing by itself
    const text = STEP_FOR_TOOL[call.tool] || `Use ${call.tool}`;
    const last = steps.at(-1);
    if (last && last.text === text) last.calls = [...(last.calls || []), call];
    else steps.push({ text, calls: [call] });
  }
  if (!steps.length) steps.push({ text: STEP_FOR_TOOL.get_attention, calls: [{ tool: "get_attention", args: {} }] });
  const title = goal.trim().replace(/\s+/g, " ").slice(0, 80) || "Goal";
  return { title, steps, source: "deterministic", intent: playbook.intent };
}

/** Best-effort mapping of a free-text step (from a model plan) to EvoPulse tool calls. */
export function callsForStepText(text: string, goal: string): PlannedCall[] {
  const q = text.toLowerCase();
  const calls: PlannedCall[] = [];
  const add = (tool: string, args: Record<string, unknown> = {}) => calls.push({ tool, args });
  if (/attention|inspect|situation|what needs/.test(q)) add("get_attention");
  if (/change|happened/.test(q)) add("get_recent_changes");
  if (/upcoming|ahead|future|forecast/.test(q)) add("get_upcoming_risks");
  if (/explain|trace|impact|cause|why|risk/.test(q) && !calls.some((c) => c.tool === "get_upcoming_risks")) add("explain_risk");
  if (/simulat|what if/.test(q)) add("simulate_change", { entity: "Atlas Supply", change: "supplier_delay", days: 3 });
  if (/goal|plan|prepare|protect|recover/.test(q)) {
    add("create_goal", { utterance: goal, idempotencyKey: "goal" });
    add("generate_plan", { idempotencyKey: "plan" });
    add("evaluate_plan");
  }
  if (/approv/.test(q)) add("request_action_approval", { idempotencyKey: "approve" });
  if (/polic|allowed/.test(q)) add("get_policy");
  if (/verif|handled|confirm/.test(q)) add("get_verification");
  return calls;
}
