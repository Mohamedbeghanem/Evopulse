import type { DatabaseSync } from "node:sqlite";
import { all } from "../db";
import { evidenceForCompatibleKind } from "../learning";
import { loadPolicies } from "../engine/policy";
import type { ActionRow, ExceptionRow } from "../types";
import { collectBusinessRisks } from "./intelligence";
import { prioritizeRisks } from "./prioritize";
import type { GoalContext, InterpretedGoal } from "./types";

const UNRELATED_KINDS = new Set(["policy_blocked"]);

export function buildGoalContext(db: DatabaseSync, goal: InterpretedGoal, goalId?: string): GoalContext {
  const allRisks = collectBusinessRisks(db);
  const relevant = allRisks.filter((risk) => {
    if (risk.resolved) return false;
    if (UNRELATED_KINDS.has(risk.kind)) return false;
    return riskMatchesGoal(goal.goalType, risk.domain, risk.kind);
  });
  const ranked = prioritizeRisks(relevant);
  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions").filter((row) =>
    ranked.some((risk) => risk.exceptionId === row.id),
  );
  const pendingApprovals = all<ActionRow>(
    db,
    "SELECT * FROM actions WHERE policy_outcome = 'APPROVAL_REQUIRED' AND status IN ('proposed', 'approved')",
  ).length;

  const primaryKind = exceptions[0]?.kind || ranked[0]?.kind || "";
  const strategyEvidence = primaryKind ? evidenceForCompatibleKind(db, primaryKind) : null;

  return {
    goal: { ...goal, id: goalId },
    risks: ranked,
    exceptions: exceptions.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      status: row.status,
      attention: row.attention,
    })),
    impacts: ranked.map((risk) => ({
      riskId: risk.id,
      associatedValue: risk.associatedValue,
      cashTimingAmount: risk.domain === "cash" ? risk.associatedValue : 0,
      kind: risk.evidence.kind,
    })),
    policies: loadPolicies(db),
    strategyEvidence,
    pendingApprovals,
  };
}

export function riskMatchesGoal(goalType: string, domain: string, kind: string): boolean {
  if (goalType === "protect_business") return true;
  if (goalType === "protect_revenue") return domain === "sales" || domain === "operations";
  if (goalType === "protect_cash") return domain === "cash";
  if (goalType === "recover_opportunities") {
    return domain === "sales" || kind === "commitment_missed" || kind === "stale_opportunity";
  }
  if (goalType === "protect_customer_commitments") {
    return domain === "customers" || domain === "sales" || domain === "operations";
  }
  return true;
}
