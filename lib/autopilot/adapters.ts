import type { DatabaseSync } from "node:sqlite";
import { all, one } from "../db";
import { detectExceptions } from "../engine/pulse";
import { getDownstream } from "../graph";
import type { CommitmentRow, ExceptionRow, ExpectationRow } from "../types";
import type { ActionTemplate } from "./types";

/**
 * Integration seams for engines that are not merged yet.
 *
 * The autopilot only talks to these three narrow interfaces. Each default is built from what is
 * on main: exception detection delegates to pulse.detectExceptions (the expectation matcher from
 * #7, landed via #10); early warnings read the graph + dependencies until §22 Early Warning exists;
 * the planner is a deterministic template. Goal plans (#6, lib/goals) are cross-business and stay
 * owned by the goal engine — a per-exception adapter over them can be registered with
 * `setAutopilotAdapters` without changing the orchestration.
 */

/** Seam for the Expectation / Exception engine. Must be idempotent. */
export interface ExceptionSource {
  name: string;
  detect(db: DatabaseSync, now: string): void;
}

export type EarlyWarning = { id: string; title: string; detail: string; source: string };

/** Seam for Early Warning (§22, not built yet). Warnings that belong to an exception are folded into its card. */
export interface EarlyWarningSource {
  name: string;
  warningsFor(db: DatabaseSync, exception: ExceptionRow, now: string): EarlyWarning[];
}

export type PlannedResponse = { title: string; summary: string; actions: ActionTemplate[] };

/**
 * Seam for per-exception planning. Asked only for exceptions that have no plan yet
 * and were not raised from a signal rule. Returning null leaves the exception without a plan.
 */
export interface ResponsePlanner {
  name: string;
  planFor(db: DatabaseSync, exception: ExceptionRow, now: string): PlannedResponse | null;
}

export const pulseExceptionSource: ExceptionSource = {
  name: "pulse-engine",
  detect: (db, now) => detectExceptions(db, now),
};

/** Default: downstream commitments at risk (graph) + expectations blocked by this one (dependencies). */
export const graphEarlyWarnings: EarlyWarningSource = {
  name: "graph-downstream",
  warningsFor(db, exception) {
    const warnings: EarlyWarning[] = [];
    if (exception.opportunity_id) {
      const { hits } = getDownstream(db, exception.opportunity_id);
      for (const hit of hits) {
        if (hit.node.type !== "commitment") continue;
        const commitment = one<CommitmentRow>(db, "SELECT * FROM commitments WHERE id = ?", [hit.node.entity_id]);
        if (commitment?.status !== "at_risk") continue;
        warnings.push({
          id: `ew_${commitment.id}`,
          title: `${commitment.description} — at risk`,
          detail: `${hit.depth} hop(s) downstream in the business graph.`,
          source: "graph",
        });
      }
    }
    if (exception.expectation_id) {
      const blocked = all<ExpectationRow>(
        db,
        `SELECT e.* FROM expectations e JOIN dependencies d ON d.from_id = e.id
         WHERE d.to_id = ? AND e.status IN ('BLOCKED', 'AT_RISK')`,
        [exception.expectation_id],
      );
      for (const exp of blocked) {
        warnings.push({
          id: `ew_${exp.id}`,
          title: `${exp.description} — ${exp.status.replace("_", " ").toLowerCase()}`,
          detail: exp.actual || "Depends on this commitment.",
          source: "dependencies",
        });
      }
    }
    return warnings;
  },
};

/** Default planner: a deterministic template for supplier delays. Everything else → no plan. */
export const templatePlanner: ResponsePlanner = {
  name: "template-planner",
  planFor(_db, exception) {
    if (exception.kind !== "delivery_delay") return null;
    return {
      title: "Contain the supplier delay",
      summary:
        "Ask the supplier for a partial shipment (internal task) and prepare a heads-up to the first affected customer. The customer message stays behind approval.",
      actions: [
        {
          type: "create_task",
          title: "Ask Atlas Supply for a partial shipment by Monday",
          description: "Internal follow-up with the supplier account manager. Reversible.",
          payload: { internal: true },
        },
        {
          type: "draft_message",
          title: "Draft heads-up to Oran Fresh",
          description: "Your Tuesday delivery may move to Thursday; we are working on a partial shipment.",
          payload: {
            to: "Oran Fresh Market",
            audience: "customer",
            body: "Heads-up: our supplier moved a shipment by two days. Your Tuesday delivery may move to Thursday — we are pushing for a partial shipment and will confirm Monday.",
          },
        },
      ],
    };
  },
};

type Adapters = {
  exceptions: ExceptionSource;
  earlyWarnings: EarlyWarningSource;
  planner: ResponsePlanner;
};

const DEFAULTS: Adapters = {
  exceptions: pulseExceptionSource,
  earlyWarnings: graphEarlyWarnings,
  planner: templatePlanner,
};

let current: Adapters = { ...DEFAULTS };

export function autopilotAdapters(): Adapters {
  return current;
}

export function setAutopilotAdapters(next: Partial<Adapters>) {
  current = { ...current, ...next };
}

export function resetAutopilotAdapters() {
  current = { ...DEFAULTS };
}
