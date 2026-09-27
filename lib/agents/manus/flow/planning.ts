/**
 * Port of OpenManus `app/flow/planning.py` (PlanningFlow).
 * 1. Create a plan with the planning tool (model plan via OpenRouter, else the deterministic planner).
 * 2. For each step: mark in_progress, run the executor agent on that step, mark the outcome.
 * 3. Finalize with a summary built from recorded results (no model call, nothing invented).
 *
 * EvoPulse additions: a step whose tools created approval items is marked `blocked` ("waiting for
 * human approval") — the work is proposed, not done; ask_human stops the flow until the person answers.
 */
import type { PlannedCall } from "../../../agent/playbooks";
import type { ToolCallAgent } from "../agent/toolcall";
import { deterministicPlan, type PlanDraft } from "../deterministic";
import type { ManusEventSink } from "../events";
import type { ManusLLM } from "../llm";
import { stepPrompt } from "../prompts";
import type { FinishReason } from "../schema";
import type { ManusApprovalRef } from "../tool";
import { formatPlan, planProgress, PlanningTool, type Plan, type PlanStepStatus } from "../tools/planning";
import { BaseFlow } from "./base";

export type FlowStepOutcome = {
  index: number;
  text: string;
  status: PlanStepStatus;
  finishReason: FinishReason;
  agentSteps: number;
  approvals: ManusApprovalRef[];
  notes: string;
};

export type FlowOutcome = {
  planId: string;
  plan: Plan;
  planSource: PlanDraft["source"];
  intent: string;
  steps: FlowStepOutcome[];
  approvals: ManusApprovalRef[];
  question: string | null;
  stoppedEarly: boolean;
  summary: string;
};

export type PlanningFlowOptions = {
  llm: ManusLLM;
  planId?: string;
  executorKeys?: string[];
  maxPlanSteps?: number;
  onEvent?: ManusEventSink;
};

export class PlanningFlow extends BaseFlow {
  readonly planningTool: PlanningTool;
  readonly activePlanId: string;
  currentStepIndex: number | null = null;
  private readonly llm: ManusLLM;
  private readonly executorKeys: string[];
  private readonly maxPlanSteps: number;
  private readonly onEvent?: ManusEventSink;
  private stepCalls: (PlannedCall[] | undefined)[] = [];

  constructor(agents: ConstructorParameters<typeof BaseFlow>[0], options: PlanningFlowOptions) {
    super(agents);
    this.llm = options.llm;
    this.activePlanId = options.planId || `plan_${Date.now()}`;
    this.executorKeys = options.executorKeys?.length ? options.executorKeys : Object.keys(this.agents);
    this.maxPlanSteps = options.maxPlanSteps ?? 8;
    this.onEvent = options.onEvent;
    this.planningTool = new PlanningTool((plan) => this.emit("plan", null, { plan: clonePlan(plan) }));
  }

  private emit(kind: Parameters<ManusEventSink>[0]["kind"], stepIndex: number | null, payload: Record<string, unknown>) {
    this.onEvent?.({ kind, stepIndex, agentStep: null, payload });
  }

  /** OpenManus `get_executor`: a `[TYPE]` tag on the step picks the agent, else the first executor. */
  getExecutor(stepType?: string | null): ToolCallAgent {
    const key = stepType ? stepType.toLowerCase() : "";
    if (key && this.agents[key]) return this.agents[key];
    for (const k of this.executorKeys) if (this.agents[k]) return this.agents[k];
    return this.primaryAgent;
  }

  async execute(goal: string): Promise<FlowOutcome> {
    const draft = await this.createInitialPlan(goal);
    const outcomes: FlowStepOutcome[] = [];
    let question: string | null = null;
    let stoppedEarly = false;
    for (let guard = 0; guard < this.maxPlanSteps; guard += 1) {
      const info = this.getCurrentStepInfo();
      if (!info) break;
      this.currentStepIndex = info.index;
      const executor = this.getExecutor(info.type);
      const outcome = await this.executeStep(executor, info.index, info.text);
      outcomes.push(outcome);
      if (outcome.finishReason === "awaiting_human") {
        question = executor.question;
        stoppedEarly = true;
        break;
      }
      if (outcome.finishReason === "limit" || outcome.finishReason === "error") {
        stoppedEarly = true;
        break;
      }
    }
    const plan = this.planningTool.get(this.activePlanId);
    const approvals = outcomes.flatMap((o) => o.approvals);
    return {
      planId: this.activePlanId,
      plan: clonePlan(plan),
      planSource: draft.source,
      intent: draft.intent,
      steps: outcomes,
      approvals,
      question,
      stoppedEarly,
      summary: this.finalizePlan(plan, outcomes, approvals, question),
    };
  }

  private async createInitialPlan(goal: string): Promise<PlanDraft> {
    let draft: PlanDraft;
    try {
      draft = await this.llm.createPlan(goal, this.primaryAgent.availableTools.toParams());
    } catch (error) {
      // OpenManus falls back to a default 3-step plan; EvoPulse falls back to the deterministic planner.
      this.emit("fallback", null, { reason: `Plan from the model failed (${error instanceof Error ? error.message : "error"}). Deterministic plan used.` });
      draft = deterministicPlan(goal);
    }
    const steps = draft.steps.slice(0, this.maxPlanSteps);
    this.stepCalls = steps.map((step) => step.calls);
    this.planningTool.run({ command: "create", plan_id: this.activePlanId, title: draft.title, steps: steps.map((s) => s.text) });
    return { ...draft, steps };
  }

  /** OpenManus `_get_current_step_info`: first not_started / in_progress step, marked in_progress. */
  getCurrentStepInfo(): { index: number; text: string; type: string | null } | null {
    const plan = this.planningTool.plans[this.activePlanId];
    if (!plan) return null;
    for (let i = 0; i < plan.steps.length; i += 1) {
      const status = plan.stepStatuses[i];
      if (status !== "not_started" && status !== "in_progress") continue;
      const type = (plan.steps[i].match(/\[([A-Z_]+)\]/) || [])[1] || null;
      this.planningTool.run({ command: "mark_step", plan_id: this.activePlanId, step_index: i, step_status: "in_progress" });
      return { index: i, text: plan.steps[i], type };
    }
    return null;
  }

  private async executeStep(executor: ToolCallAgent, index: number, text: string): Promise<FlowStepOutcome> {
    const plan = this.planningTool.get(this.activePlanId);
    this.emit("step_start", index, { text });
    executor.stepIndex = index;
    executor.stepText = text;
    executor.plannedCalls = executor.llm.mode === "deterministic" ? this.stepCalls[index] : undefined;
    const run = await executor.run(stepPrompt(formatPlan(plan), index, text));
    const approvals = [...executor.pendingApprovals];
    const { status, notes } = stepStatusFor(run.finishReason, executor.terminateStatus, approvals.length, executor.question);
    this.planningTool.run({ command: "mark_step", plan_id: this.activePlanId, step_index: index, step_status: status, step_notes: notes });
    this.emit("step_end", index, { status, notes, finishReason: run.finishReason, agentSteps: run.steps });
    return { index, text, status, finishReason: run.finishReason, agentSteps: run.steps, approvals, notes };
  }

  private finalizePlan(plan: Plan, outcomes: FlowStepOutcome[], approvals: ManusApprovalRef[], question: string | null): string {
    const p = planProgress(plan);
    const parts = [`${p.completed} of ${p.total} steps completed.`];
    if (approvals.length) parts.push(`${approvals.length} action${approvals.length === 1 ? "" : "s"} waiting for your approval — nothing was executed.`);
    if (question) parts.push(`Waiting for your answer: ${question}`);
    const failed = outcomes.filter((o) => o.status === "blocked" && !o.approvals.length && o.finishReason !== "awaiting_human").length;
    if (failed > 0) parts.push(`${failed} step${failed === 1 ? "" : "s"} could not be completed.`);
    return parts.join(" ");
  }
}

function stepStatusFor(
  reason: FinishReason,
  terminateStatus: "success" | "failure" | null,
  approvals: number,
  question: string | null,
): { status: PlanStepStatus; notes: string } {
  if (reason === "awaiting_human") return { status: "blocked", notes: `Waiting for your answer: ${question || ""}`.trim() };
  if (approvals > 0) return { status: "blocked", notes: `Waiting for human approval: ${approvals} action${approvals === 1 ? "" : "s"}` };
  if (reason === "max_steps") return { status: "blocked", notes: "Reached the step limit before finishing." };
  if (reason === "stuck") return { status: "blocked", notes: "Stuck: stopped after a change of strategy did not help." };
  if (reason === "limit") return { status: "blocked", notes: "A safety limit stopped the run." };
  if (reason === "terminated" && terminateStatus === "failure") return { status: "blocked", notes: "Could not complete this step with the available tools." };
  return { status: "completed", notes: "" };
}

function clonePlan(plan: Plan): Plan {
  return { ...plan, steps: [...plan.steps], stepStatuses: [...plan.stepStatuses], stepNotes: [...plan.stepNotes] };
}
