import type { DatabaseSync } from "node:sqlite";
import { formatDay, formatMoney } from "../clock";
import { all, getMeta, one } from "../db";
import { IDS } from "../ids";
import type { ActionRow, CommitmentRow, ExceptionRow, ExpectationRow } from "../types";
import { CANNED_PROMPTS } from "../prompts";

export { CANNED_PROMPTS };

function groundedHeader(db: DatabaseSync) {
  const now = getMeta(db, "demo_now");
  const phase = getMeta(db, "demo_phase", "seeded");
  return { now, phase };
}

export function answerQuestion(db: DatabaseSync, question: string) {
  const q = question.toLowerCase();
  const { now, phase } = groundedHeader(db);
  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions");
  const commitments = all<CommitmentRow>(db, "SELECT * FROM commitments");
  const expectations = all<ExpectationRow>(db, "SELECT * FROM expectations");
  const actions = all<ActionRow>(db, "SELECT * FROM actions");
  const need = exceptions.filter((e) => e.attention === "NEEDS_YOU");

  if (/attention|needs you|changed today|what should i/.test(q)) {
    const first = need[0];
    return {
      question,
      grounded: true,
      answer: first
        ? `${formatMoney(320000)} needs you. ${first.title}. Evidence is the Wednesday Atlas message. Our proposal was due ${formatDay(expectations.find((e) => e.id === IDS.expectOurs)?.due_at || now)} and was not sent, so the Friday decision is blocked.`
        : phase === "recovered"
          ? "The 320K recovery was executed. A customer-response verification is pending — send alone does not mark the exception solved. Nothing else is NEEDS YOU."
          : phase === "discount_blocked"
            ? "10% discount is BLOCKED by policy discount_max=5%. An alternative recovery (5% or Net-14) is waiting."
            : "No open NEEDS YOU items.",
      citations: need.map((e) => ({ type: "exception", id: e.id, title: e.title })),
      now,
      phase,
    };
  }

  if (/promise|commitment|we make|customers make/.test(q)) {
    const ours = commitments.filter((c) => c.actor === "company");
    const theirs = commitments.filter((c) => c.actor === "customer");
    return {
      question,
      grounded: true,
      answer: `We promised: ${ours.map((c) => `${c.description} by ${formatDay(c.deadline)} (${c.status})`).join("; ") || "none"}. They promised: ${theirs.map((c) => `${c.description} by ${formatDay(c.deadline)} (${c.status})`).join("; ") || "none"}. Customer decision depends on our revised proposal.`,
      citations: commitments.map((c) => ({ type: "commitment", id: c.id, title: c.description })),
      now,
      phase,
    };
  }

  if (/risk|revenue|320|cash|miss/.test(q)) {
    const blocked = actions.find((a) => a.policy_outcome === "BLOCKED");
    return {
      question,
      grounded: true,
      answer: blocked
        ? `Revenue at risk: 320,000 DZD Atlas opportunity. A 10% discount was proposed and BLOCKED (discount_max=5%). Alternative: 5% (304,000 DZD) or list price with Net-14 and a pulled-forward slot.`
        : `Revenue at risk: 320,000 DZD. The Friday decision is blocked because the Thursday proposal never left. No other opportunities are in this MVP graph.`,
      citations: [
        { type: "opportunity", id: IDS.opportunity, title: "Atlas Q4 proposal 320,000 DZD" },
        ...exceptions.map((e) => ({ type: "exception", id: e.id, title: e.title })),
      ],
      now,
      phase,
    };
  }

  const first = need[0] || exceptions[0];
  return {
    question,
    grounded: true,
    answer: first
      ? `I only answer from business state. Right now the live object is: ${first.title}. Ask about attention, promises, or revenue risk.`
      : "I only answer from business state, and the graph is quiet.",
    citations: first ? [{ type: "exception", id: first.id, title: first.title }] : [],
    now,
    phase,
  };
}
