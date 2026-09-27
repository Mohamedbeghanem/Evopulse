import { DEMO_NOW_ISO } from "../clock";
import type { BusinessRisk, PriorityBreakdown, RankedRisk } from "./types";

function severityWeight(severity: string): number {
  const key = severity.toLowerCase();
  if (key === "critical") return 40;
  if (key === "high") return 25;
  if (key === "medium") return 15;
  return 5;
}

function deadlineWeight(deadline: string | undefined, now: string): number {
  if (!deadline) return 10;
  const due = new Date(deadline).getTime();
  const current = new Date(now).getTime();
  if (Number.isNaN(due) || Number.isNaN(current)) return 10;
  const hours = (due - current) / 36e5;
  if (hours < 0) return 35;
  if (hours <= 72) return 25;
  if (hours <= 168) return 15;
  return 5;
}

function impactWeight(value: number): number {
  return Math.min(35, Math.round(value / 25000));
}

function dependencyWeight(count: number): number {
  return Math.min(15, count * 4);
}

function customerWeight(count: number): number {
  return Math.min(15, count * 5);
}

export function scoreRisk(risk: BusinessRisk, now = DEMO_NOW_ISO): PriorityBreakdown {
  const breakdown: PriorityBreakdown = {
    severityWeight: severityWeight(risk.severity),
    deadlineWeight: deadlineWeight(risk.deadline, now),
    impactWeight: impactWeight(risk.associatedValue),
    dependencyWeight: dependencyWeight(risk.dependencyCount),
    customerWeight: customerWeight(risk.affectedCustomers),
    score: 0,
    whyFirst: "",
  };
  breakdown.score =
    breakdown.severityWeight +
    breakdown.deadlineWeight +
    breakdown.impactWeight +
    breakdown.dependencyWeight +
    breakdown.customerWeight;
  breakdown.whyFirst = [
    `${risk.severity} severity (${breakdown.severityWeight})`,
    risk.deadline ? `deadline weight ${breakdown.deadlineWeight}` : "no explicit deadline",
    `${risk.associatedValue.toLocaleString("en-US")} ${risk.currency} impact (${breakdown.impactWeight})`,
    `${risk.dependencyCount} dependencies (${breakdown.dependencyWeight})`,
    `${risk.affectedCustomers} customers (${breakdown.customerWeight})`,
  ].join(" · ");
  return breakdown;
}

export function prioritizeRisks(risks: BusinessRisk[], now = DEMO_NOW_ISO): RankedRisk[] {
  return [...risks]
    .map((risk) => ({ ...risk, priority: scoreRisk(risk, now), rank: 0 }))
    .sort((a, b) => b.priority.score - a.priority.score || b.associatedValue - a.associatedValue)
    .map((risk, index) => ({ ...risk, rank: index + 1 }));
}
