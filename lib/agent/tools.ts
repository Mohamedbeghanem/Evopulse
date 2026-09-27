import type { DatabaseSync } from "node:sqlite";
import { all, getMeta, one } from "../db";
import { answerQuestion } from "../engine/ask";
import { calculateGraphImpact } from "../engine/impact";
import { evaluatePolicy, loadPolicies, recheckActionPolicy } from "../engine/policy";
import { buildTimeline } from "../engine/timeline";
import { businessTwin } from "../engine/twin";
import { eventsFor } from "../events";
import {
  createGoal,
  executeSafeActions,
  hydratePlan,
  buildPlan,
  collectBusinessRisks,
} from "../goals";
import { IDS } from "../ids";
import { SEED_FOLLOWUP_SIGNATURE, StrategyMemory, VerificationService } from "../learning";
import { runSimulation } from "../simulation";
import type { ActionRow, ExceptionRow } from "../types";
import { pulseBoard } from "../ui/attention";
import type { GovernedToolDefinition, ToolCallRecord, ToolCategory } from "./types";

export const GOVERNED_TOOLS: GovernedToolDefinition[] = [
  {
    name: "get_business_state",
    category: "READ",
    description: "Read the current Business Twin, pulse counts, and demo clock. Does not invent money.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_recent_changes",
    category: "READ",
    description: "List recent stored business events and timeline spots.",
    parameters: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false },
  },
  {
    name: "get_attention",
    category: "READ",
    description: "Return current attention / situations from Pulse. Stored attention is unchanged.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_upcoming_risks",
    category: "READ",
    description: "Return ranked business risks collected from canonical engines.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "explain_risk",
    category: "READ",
    description: "Explain a risk using graph impact and grounded ask. Money comes from engines.",
    parameters: {
      type: "object",
      properties: { question: { type: "string" }, entityId: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_evidence",
    category: "READ",
    description: "Return stored evidence for an exception or the primary open situation.",
    parameters: { type: "object", properties: { exceptionId: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "simulate_change",
    category: "READ",
    description: "Run the canonical Business Simulator. Reality is not written.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string" },
        targetId: { type: "string" },
        days: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "evaluate_plan",
    category: "READ",
    description: "Hydrate a stored plan and return policy-classified actions.",
    parameters: { type: "object", properties: { planId: { type: "string" } }, required: ["planId"], additionalProperties: false },
  },
  {
    name: "get_safe_actions",
    category: "READ",
    description: "List AUTO actions on a plan after a live policy recheck. Does not execute.",
    parameters: { type: "object", properties: { planId: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "get_verification",
    category: "READ",
    description: "Read verification rows. Cannot mark SUCCESS, FAIL, or HANDLED.",
    parameters: { type: "object", properties: { exceptionId: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "get_historical_cases",
    category: "READ",
    description: "Return stored strategy memory for similar cases. Observations, not predictions.",
    parameters: { type: "object", properties: { signature: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "get_policy",
    category: "READ",
    description: "Load live policies and optionally evaluate a proposed action. Rechecks current policy.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string" },
        payload: { type: "object" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_autopilot_trace",
    category: "READ",
    description: "List recently executed AUTO actions. Autopilot cannot approve or verify.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_goal",
    category: "PREPARE",
    description: "Create a governed goal from an utterance. Does not execute actions.",
    parameters: {
      type: "object",
      properties: { utterance: { type: "string" }, plan: { type: "boolean" } },
      required: ["utterance"],
      additionalProperties: false,
    },
  },
  {
    name: "generate_plan",
    category: "PREPARE",
    description: "Generate a structured plan for an existing goal using the planner.",
    parameters: { type: "object", properties: { goalId: { type: "string" } }, required: ["goalId"], additionalProperties: false },
  },
  {
    name: "execute_safe_actions",
    category: "EXECUTE_SAFE",
    description: "Execute only AUTO actions after a live policy recheck. Cannot approve or unblock.",
    parameters: { type: "object", properties: { planId: { type: "string" } }, required: ["planId"], additionalProperties: false },
  },
  {
    name: "request_action_approval",
    category: "HUMAN_REQUIRED",
    description: "Request human approval for consequential actions. Does not grant approval.",
    parameters: {
      type: "object",
      properties: { planId: { type: "string" }, actionId: { type: "string" } },
      additionalProperties: false,
    },
  },
];

export const FORBIDDEN_TOOLS = new Set([
  "approve_action",
  "mutate_policy",
  "change_policy",
  "mutate_permissions",
  "raw_sql",
  "shell",
  "filesystem",
  "delete_arbitrary",
  "secret_access",
  "mark_verified",
  "mark_handled",
  "bypass_policy",
]);

const ALLOWED = new Map(GOVERNED_TOOLS.map((tool) => [tool.name, tool]));

export function listAllowedToolNames(): string[] {
  return GOVERNED_TOOLS.map((tool) => tool.name);
}

export function getToolDefinition(name: string): GovernedToolDefinition | undefined {
  return ALLOWED.get(name);
}

export function classifyToolName(name: string): ToolCategory | "UNKNOWN" {
  if (FORBIDDEN_TOOLS.has(name)) return "FORBIDDEN";
  return ALLOWED.get(name)?.category || "UNKNOWN";
}

export function executeGovernedTool(
  db: DatabaseSync,
  name: string,
  args: Record<string, unknown>,
  callId: string,
): ToolCallRecord {
  const category = classifyToolName(name);
  if (category === "FORBIDDEN" || category === "UNKNOWN") {
    return {
      id: callId,
      name,
      category,
      arguments: args,
      ok: false,
      forbidden: true,
      result: null,
      error:
        category === "FORBIDDEN"
          ? `${name} is forbidden. The model cannot approve actions, mutate policy, mark verification, or access secrets.`
          : `${name} is not a governed EvoPulse tool. The model cannot invent tools.`,
    };
  }

  try {
    const result = dispatchTool(db, name, args);
    return { id: callId, name, category, arguments: args, ok: true, forbidden: false, result };
  } catch (error) {
    return {
      id: callId,
      name,
      category,
      arguments: args,
      ok: false,
      forbidden: false,
      result: null,
      error: error instanceof Error ? error.message : "tool failed",
    };
  }
}

function dispatchTool(db: DatabaseSync, name: string, args: Record<string, unknown>): unknown {
  const now = getMeta(db, "demo_now");
  switch (name) {
    case "get_business_state": {
      const board = pulseBoard(db);
      return {
        now: board.now,
        phase: board.phase,
        supplierPhase: board.supplierPhase,
        counts: board.counts,
        twin: businessTwin(db),
        note: "Authoritative state from EvoPulse engines. Not a model estimate.",
      };
    }
    case "get_recent_changes": {
      const limit = Math.min(Number(args.limit) || 12, 40);
      const events = eventsFor(db).list().slice(-limit);
      const timeline = buildTimeline(db);
      return {
        events: events.map((event) => ({
          id: event.id,
          type: event.type,
          occurredAt: event.occurred_at,
          payload: redactSecrets(event.payload),
        })),
        timeline: timeline.spots?.slice(0, limit) ?? timeline,
      };
    }
    case "get_attention": {
      const board = pulseBoard(db);
      return {
        counts: board.counts,
        needs: board.needs.map(compactSituation),
        monitoring: board.monitoring.map(compactSituation),
        handled: board.handled.map(compactSituation),
      };
    }
    case "get_upcoming_risks": {
      return {
        risks: collectBusinessRisks(db).map((risk) => ({
          id: risk.id,
          domain: risk.domain,
          title: risk.title,
          associatedValue: risk.associatedValue,
          currency: risk.currency,
          affectedOrders: risk.affectedOrders,
          affectedCustomers: risk.affectedCustomers,
          deadline: risk.deadline,
          status: risk.status,
          resolved: risk.resolved,
        })),
      };
    }
    case "explain_risk": {
      const entityId = String(args.entityId || IDS.shipment);
      const impact = calculateGraphImpact(db, entityId);
      const question = String(args.question || "Why is 850K at risk?");
      const grounded = answerQuestion(db, question);
      return {
        associatedRevenue: impact.associated_revenue,
        expectedCashTiming: impact.affected_expected_cash,
        affectedOrders: impact.affected_orders,
        affectedCustomers: impact.affected_customers,
        currency: impact.currency,
        notes: impact.notes,
        groundedAnswer: grounded.answer,
        citations: grounded.citations,
        labels: {
          associatedRevenue: "associated revenue — not lost revenue",
          expectedCashTiming: "expected cash timing — not guaranteed loss",
        },
      };
    }
    case "get_evidence": {
      const exceptionId = String(args.exceptionId || "");
      const row = exceptionId
        ? one<ExceptionRow>(db, "SELECT * FROM exceptions WHERE id = ?", [exceptionId])
        : all<ExceptionRow>(db, "SELECT * FROM exceptions ORDER BY created_at DESC")[0];
      if (!row) return { found: false, note: "EvoPulse does not have a stored exception for this request." };
      return {
        id: row.id,
        title: row.title,
        kind: row.kind,
        attention: row.attention,
        status: row.status,
        evidence: safeJson(row.evidence_json),
        impact: safeJson(row.impact_json),
      };
    }
    case "simulate_change": {
      const result = runSimulation(db, {
        type: String(args.type || "supplier_delay"),
        targetId: String(args.targetId || IDS.shipment),
        days: Number(args.days || 3),
      });
      return {
        mode: result.mode,
        isolation: result.isolation,
        delta: result.delta,
        baseline: result.baseline,
        simulated: result.simulated,
        note: "Simulation is isolated. Reality is unchanged. Delta is engine-calculated.",
      };
    }
    case "evaluate_plan": {
      return hydratePlan(db, String(args.planId));
    }
    case "get_safe_actions": {
      const planId = String(args.planId || latestPlanId(db) || "");
      if (!planId) return { actions: [], note: "No plan is available." };
      const plan = hydratePlan(db, planId);
      const policies = loadPolicies(db);
      const actions = plan.actions.map((action) => {
        const recheck = evaluatePolicy({ type: action.type, payload: action.parameters }, policies);
        return {
          id: action.id,
          title: action.title,
          type: action.type,
          stored: action.policyDecision,
          live: recheck.outcome,
          reason: recheck.reason,
          executable: recheck.outcome === "AUTO",
        };
      });
      return { planId, actions, auto: actions.filter((action) => action.executable) };
    }
    case "get_verification": {
      const pending = VerificationService.for(db).getPendingVerifications(
        args.exceptionId ? String(args.exceptionId) : undefined,
      );
      return {
        pending,
        note: "Verification owns resolution. EXECUTED is not HANDLED. The model cannot mark verification.",
      };
    }
    case "get_historical_cases": {
      const signature = String(args.signature || SEED_FOLLOWUP_SIGNATURE);
      return StrategyMemory.for(db).getStrategyEvidence(signature);
    }
    case "get_policy": {
      const policies = loadPolicies(db);
      if (args.type) {
        const proposed = { type: String(args.type), payload: asRecord(args.payload) };
        const live = recheckActionPolicy(db, proposed);
        return { policies, proposed, live, note: "Live policy recheck. Previous classifications are not trusted." };
      }
      return { policies };
    }
    case "get_autopilot_trace": {
      const executed = all<ActionRow>(
        db,
        "SELECT * FROM actions WHERE policy_outcome = 'AUTO' AND status = 'executed' ORDER BY created_at DESC LIMIT 20",
      );
      return {
        executed: executed.map((row) => ({ id: row.id, type: row.type, title: row.title, status: row.status })),
        note: "AUTO execution is not approval and is not HANDLED.",
      };
    }
    case "create_goal": {
      return createGoal(db, { utterance: String(args.utterance), source: "agent" }, now, {
        plan: args.plan !== false,
      });
    }
    case "generate_plan": {
      return buildPlan(db, String(args.goalId), now);
    }
    case "execute_safe_actions": {
      const planId = String(args.planId);
      const plan = hydratePlan(db, planId);
      for (const action of plan.actions) {
        const live = recheckActionPolicy(db, { type: action.type, payload: action.parameters });
        if (action.policyDecision === "AUTO" && live.outcome !== "AUTO") {
          return {
            refused: true,
            reason: `Policy recheck changed ${action.title} from AUTO to ${live.outcome}.`,
            live,
          };
        }
        if (live.outcome === "BLOCKED") {
          continue;
        }
      }
      return executeSafeActions(db, planId, now, "agent");
    }
    case "request_action_approval": {
      const planId = String(args.planId || latestPlanId(db) || "");
      if (!planId) return { requested: false, note: "No plan to request approval on." };
      const plan = hydratePlan(db, planId);
      const waiting = plan.actions.filter((action) => {
        const live = recheckActionPolicy(db, { type: action.type, payload: action.parameters });
        return live.outcome === "APPROVAL_REQUIRED";
      });
      const blocked = plan.actions.filter((action) => {
        const live = recheckActionPolicy(db, { type: action.type, payload: action.parameters });
        return live.outcome === "BLOCKED";
      });
      return {
        requested: true,
        approved: false,
        planId,
        waiting: waiting.map((action) => ({ id: action.id, title: action.title, reason: action.policyReason })),
        blocked: blocked.map((action) => ({ id: action.id, title: action.title, reason: action.policyReason })),
        note: "A human must approve through the existing EvoPulse approval flow. The model cannot approve.",
      };
    }
    default:
      throw new Error("Unhandled governed tool.");
  }
}

function compactSituation(situation: ReturnType<typeof pulseBoard>["needs"][number]) {
  return {
    id: situation.id,
    title: situation.title,
    summary: situation.summary,
    projection: situation.projection,
    storedAttention: situation.storedAttention,
    money: situation.money,
    cashTiming: situation.cashTiming,
    href: situation.primaryHref,
  };
}

function latestPlanId(db: DatabaseSync): string | undefined {
  return one<{ id: string }>(db, "SELECT id FROM plans ORDER BY created_at DESC")?.id;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function redactSecrets(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const record = { ...(payload as Record<string, unknown>) };
  for (const key of Object.keys(record)) {
    if (/key|secret|token|password|authorization/i.test(key)) record[key] = "[redacted]";
  }
  return record;
}
