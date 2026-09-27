import type { DatabaseSync } from "node:sqlite";
import { all, one } from "../db";
import { workspaceMode } from "../company";
import { pulseOutcome } from "./outcomes";

/**
 * The 90-second demo path. Each step links an existing screen; completion is read from real state
 * (workspace mode, agent runs, actions, verifications, exceptions) — no client-side checklist state.
 */

export type DemoPathStep = {
  id: string;
  label: string;
  href: string;
  done: boolean;
  hint: string;
};

export const DEMO_COMMANDS = {
  why: "Why is 850K at risk?",
  simulate: "Simulate Atlas +3 days",
  protect: "Protect everything at risk this week.",
} as const;

export const DISCOUNT_SITUATION_ID = "exc_discount_blocked";

const commandHref = (command: string) => `/command?q=${encodeURIComponent(command)}`;

export function demoPath(db: DatabaseSync): { steps: DemoPathStep[]; currentStepId: string | null } {
  const running = workspaceMode(db) === "running";
  const ran = (pattern: string) =>
    running && tableHas(db, "agent_runs") &&
    (one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM agent_runs WHERE lower(command) LIKE ?", [pattern])?.n || 0) > 0;
  const discount = one<{ attention: string }>(db, "SELECT attention FROM exceptions WHERE id = ?", [DISCOUNT_SITUATION_ID]);
  const blocked10 = all<{ payload: string }>(
    db,
    "SELECT payload FROM actions WHERE type = 'apply_discount' AND policy_outcome = 'BLOCKED'",
  ).some((row) => Number(parse(row.payload).percent) > 5);
  const alternativeExecuted = all<{ type: string; payload: string }>(
    db,
    "SELECT type, payload FROM actions WHERE status = 'executed' AND type IN ('offer_alternative', 'apply_discount')",
  ).some((row) => row.type === "offer_alternative" || Number(parse(row.payload).percent) <= 5);
  const verified = (one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM verifications WHERE status = 'SUCCESS'")?.n || 0) > 0;
  const outcome = running ? pulseOutcome(db) : null;
  const situationHref = discount ? `/situations/${DISCOUNT_SITUATION_ID}` : "/inbox";

  const steps: DemoPathStep[] = [
    { id: "create", label: "Create company", href: "/", done: running, hint: "Home → Create a company → Atlas Medical Distribution" },
    { id: "pulse", label: "Pulse", href: "/", done: running, hint: "The live board: what needs you, what is monitored" },
    { id: "why", label: "Why is 850K at risk?", href: commandHref(DEMO_COMMANDS.why), done: ran("%850%"), hint: "Associated revenue vs expected cash timing" },
    { id: "simulate", label: "Simulate Atlas +3 days", href: commandHref(DEMO_COMMANDS.simulate), done: ran("%simulat%"), hint: "Invoice C 160K moves; reality is unchanged" },
    { id: "protect", label: "Protect everything at risk", href: commandHref(DEMO_COMMANDS.protect), done: ran("%protect%"), hint: "Plan with approvals; policy rechecked before execution" },
    { id: "blocked", label: "10% discount blocked", href: "/inbox#demo-triggers", done: blocked10, hint: "Amine asks for 10%; policy caps discounts at 5%" },
    { id: "alternative", label: "Approve the governed alternative", href: discount ? `/exceptions/${DISCOUNT_SITUATION_ID}/plan` : "/inbox", done: alternativeExecuted, hint: "You approve; the AI cannot approve its own action" },
    { id: "reply", label: "Reply arrives", href: "/inbox", done: verified, hint: "Deliver the reply; only the same party can verify" },
    { id: "handled", label: "HANDLED after verification", href: situationHref, done: (outcome?.protected.verifiedSituations || 0) > 0, hint: "Executed is not handled — the reply verifies it" },
    { id: "outcome", label: "Outcome", href: "/#outcome", done: (outcome?.protected.associatedRevenue || 0) > 0, hint: "Exposure detected vs value protected" },
  ];
  return { steps, currentStepId: steps.find((step) => !step.done)?.id || null };
}

function tableHas(db: DatabaseSync, name: string) {
  return all(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [name]).length > 0;
}

function parse(raw: string | null | undefined): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
