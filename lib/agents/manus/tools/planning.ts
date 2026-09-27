/**
 * Port of OpenManus `app/tool/planning.py` (PlanningTool).
 * Commands: create, update, list, get, set_active, mark_step, delete. Plans live in memory for the
 * run; every change is reported through `onChange` so the runtime can persist it to the run trace.
 */
import type { ManusTool, ManusToolOutcome } from "../tool";

export const PLANNING = "planning";
export const PLAN_STEP_STATUSES = ["not_started", "in_progress", "completed", "blocked"] as const;
export type PlanStepStatus = (typeof PLAN_STEP_STATUSES)[number];

export const STEP_MARK: Record<PlanStepStatus, string> = {
  completed: "[✓]",
  in_progress: "[→]",
  blocked: "[!]",
  not_started: "[ ]",
};

export type Plan = {
  planId: string;
  title: string;
  steps: string[];
  stepStatuses: PlanStepStatus[];
  stepNotes: string[];
};

export class PlanningError extends Error {}

export class PlanningTool {
  readonly name = PLANNING;
  readonly plans: Record<string, Plan> = {};
  currentPlanId: string | null = null;

  constructor(private readonly onChange?: (plan: Plan) => void) {}

  run(args: Record<string, unknown>): string {
    const command = String(args.command || "");
    const planId = args.plan_id ? String(args.plan_id) : undefined;
    switch (command) {
      case "create":
        return this.create(planId, args.title, args.steps);
      case "update":
        return this.update(planId, args.title, args.steps);
      case "list":
        return this.list();
      case "get":
        return formatPlan(this.resolve(planId));
      case "set_active":
        return this.setActive(planId);
      case "mark_step":
        return this.markStep(planId, args.step_index, args.step_status, args.step_notes);
      case "delete":
        return this.remove(planId);
      default:
        throw new PlanningError(
          `Unrecognized command: ${command}. Allowed commands are: create, update, list, get, set_active, mark_step, delete`,
        );
    }
  }

  get(planId?: string): Plan {
    return this.resolve(planId);
  }

  asTool(): ManusTool {
    return {
      name: PLANNING,
      description:
        "A planning tool that allows the agent to create and manage plans for solving complex tasks. Commands: create, update, list, get, set_active, mark_step, delete.",
      parameters: {
        command: { type: "string", required: true, enum: ["create", "update", "list", "get", "set_active", "mark_step", "delete"] },
        plan_id: { type: "string", description: "Unique identifier for the plan." },
        title: { type: "string", description: "Title for the plan." },
        steps: { type: "array", description: "List of plan steps (strings)." },
        step_index: { type: "number", description: "Index of the step to update (0-based)." },
        step_status: { type: "string", enum: [...PLAN_STEP_STATUSES] },
        step_notes: { type: "string", description: "Additional notes for a step." },
      },
      kind: "control",
      source: "native",
      available: true,
      execute: async (args): Promise<ManusToolOutcome> => {
        try {
          return { status: "ok", output: this.run(args) };
        } catch (error) {
          const message = error instanceof Error ? error.message : "planning failed";
          return { status: "failed", output: message, error: message };
        }
      },
    };
  }

  private create(planId: string | undefined, title: unknown, steps: unknown): string {
    if (!planId) throw new PlanningError("Parameter `plan_id` is required for command: create");
    if (this.plans[planId]) throw new PlanningError(`A plan with ID '${planId}' already exists. Use 'update' to modify existing plans.`);
    if (!title) throw new PlanningError("Parameter `title` is required for command: create");
    const clean = cleanSteps(steps);
    if (!clean) throw new PlanningError("Parameter `steps` must be a non-empty list of strings for command: create");
    const plan: Plan = {
      planId,
      title: String(title).slice(0, 200),
      steps: clean,
      stepStatuses: clean.map(() => "not_started"),
      stepNotes: clean.map(() => ""),
    };
    this.plans[planId] = plan;
    this.currentPlanId = planId;
    this.onChange?.(plan);
    return `Plan created successfully with ID: ${planId}\n\n${formatPlan(plan)}`;
  }

  private update(planId: string | undefined, title: unknown, steps: unknown): string {
    if (!planId) throw new PlanningError("Parameter `plan_id` is required for command: update");
    const plan = this.plans[planId];
    if (!plan) throw new PlanningError(`No plan found with ID: ${planId}`);
    if (title) plan.title = String(title).slice(0, 200);
    if (steps !== undefined) {
      const clean = cleanSteps(steps);
      if (!clean) throw new PlanningError("Parameter `steps` must be a list of strings for command: update");
      // Keep status/notes for unchanged steps (OpenManus behaviour).
      const statuses: PlanStepStatus[] = [];
      const notes: string[] = [];
      clean.forEach((step, index) => {
        const same = index < plan.steps.length && plan.steps[index] === step;
        statuses.push(same ? plan.stepStatuses[index] : "not_started");
        notes.push(same ? plan.stepNotes[index] : "");
      });
      plan.steps = clean;
      plan.stepStatuses = statuses;
      plan.stepNotes = notes;
    }
    this.onChange?.(plan);
    return `Plan updated successfully: ${planId}\n\n${formatPlan(plan)}`;
  }

  private list(): string {
    const ids = Object.keys(this.plans);
    if (!ids.length) return "No plans available. Create a plan with the 'create' command.";
    return [
      "Available plans:",
      ...ids.map((id) => {
        const plan = this.plans[id];
        const done = plan.stepStatuses.filter((s) => s === "completed").length;
        return `• ${id}${id === this.currentPlanId ? " (active)" : ""}: ${plan.title} - ${done}/${plan.steps.length} steps completed`;
      }),
    ].join("\n");
  }

  private setActive(planId: string | undefined): string {
    if (!planId) throw new PlanningError("Parameter `plan_id` is required for command: set_active");
    const plan = this.resolve(planId);
    this.currentPlanId = planId;
    return `Plan '${planId}' is now the active plan.\n\n${formatPlan(plan)}`;
  }

  private markStep(planId: string | undefined, stepIndex: unknown, status: unknown, notes: unknown): string {
    const plan = this.resolve(planId);
    if (stepIndex === undefined || stepIndex === null) throw new PlanningError("Parameter `step_index` is required for command: mark_step");
    const index = Number(stepIndex);
    if (!Number.isInteger(index) || index < 0 || index >= plan.steps.length) {
      throw new PlanningError(`Invalid step_index: ${String(stepIndex)}. Valid indices range from 0 to ${plan.steps.length - 1}.`);
    }
    if (status !== undefined && status !== null) {
      if (!PLAN_STEP_STATUSES.includes(status as PlanStepStatus)) {
        throw new PlanningError(`Invalid step_status: ${String(status)}. Valid statuses are: ${PLAN_STEP_STATUSES.join(", ")}`);
      }
      plan.stepStatuses[index] = status as PlanStepStatus;
    }
    if (notes !== undefined && notes !== null) plan.stepNotes[index] = String(notes).slice(0, 500);
    this.onChange?.(plan);
    return `Step ${index} updated in plan '${plan.planId}'.\n\n${formatPlan(plan)}`;
  }

  private remove(planId: string | undefined): string {
    if (!planId) throw new PlanningError("Parameter `plan_id` is required for command: delete");
    if (!this.plans[planId]) throw new PlanningError(`No plan found with ID: ${planId}`);
    delete this.plans[planId];
    if (this.currentPlanId === planId) this.currentPlanId = null;
    return `Plan '${planId}' has been deleted.`;
  }

  private resolve(planId?: string): Plan {
    const id = planId || this.currentPlanId;
    if (!id) throw new PlanningError("No active plan. Please specify a plan_id or set an active plan.");
    const plan = this.plans[id];
    if (!plan) throw new PlanningError(`No plan found with ID: ${id}`);
    return plan;
  }
}

function cleanSteps(steps: unknown): string[] | null {
  if (!Array.isArray(steps) || !steps.length) return null;
  const clean = steps.map((step) => String(step ?? "").trim().slice(0, 240)).filter(Boolean).slice(0, 12);
  return clean.length ? clean : null;
}

export function planProgress(plan: Plan) {
  const count = (status: PlanStepStatus) => plan.stepStatuses.filter((s) => s === status).length;
  return {
    total: plan.steps.length,
    completed: count("completed"),
    inProgress: count("in_progress"),
    blocked: count("blocked"),
    notStarted: count("not_started"),
  };
}

export function formatPlan(plan: Plan): string {
  const p = planProgress(plan);
  const pct = p.total ? (p.completed / p.total) * 100 : 0;
  const header = `Plan: ${plan.title} (ID: ${plan.planId})`;
  const lines = [
    header,
    "=".repeat(header.length),
    "",
    `Progress: ${p.completed}/${p.total} steps completed (${pct.toFixed(1)}%)`,
    `Status: ${p.completed} completed, ${p.inProgress} in progress, ${p.blocked} blocked, ${p.notStarted} not started`,
    "",
    "Steps:",
  ];
  plan.steps.forEach((step, index) => {
    lines.push(`${index}. ${STEP_MARK[plan.stepStatuses[index]]} ${step}`);
    if (plan.stepNotes[index]) lines.push(`   Notes: ${plan.stepNotes[index]}`);
  });
  return lines.join("\n");
}
