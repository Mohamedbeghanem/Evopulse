import type { DatabaseSync } from "node:sqlite";
import { CHECKPOINT_ISO } from "../clock";
import { all, one, run } from "../db";
import { IDS } from "../ids";
import { evaluatePolicy, loadPolicies, planOutcome } from "./policy";
import type { ActionRow, ExceptionRow, PlanRow } from "../types";
import { evidenceForCompatibleKind } from "../learning";

export function buildRecoveryPlan(db: DatabaseSync, exceptionId: string, now: string): PlanRow {
  const exception = one<ExceptionRow>(db, "SELECT * FROM exceptions WHERE id = ?", [exceptionId]);
  if (!exception) throw new Error("Exception not found");

  const existing = one<PlanRow>(db, "SELECT * FROM plans WHERE exception_id = ?", [exceptionId]);
  if (existing) return existing;

  if (exceptionId === IDS.excDiscount || exception.kind === "policy_blocked") {
    return buildDiscountAlternative(db, exceptionId, now);
  }

  const policies = loadPolicies(db);
  const prepare = evaluatePolicy({ type: "prepare_proposal", payload: {} }, policies);
  const draft = evaluatePolicy(
    { type: "draft_message", payload: { channel: "email", audience: "customer" } },
    policies,
  );
  const check = evaluatePolicy({ type: "create_checkpoint", payload: {} }, policies);
  const outcome = planOutcome([prepare.outcome, draft.outcome, check.outcome]);

  run(
    db,
    `INSERT INTO plans (id, exception_id, title, summary, status, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      IDS.planRecovery,
      exceptionId,
      "Recover the 320K Atlas decision",
      "Prepare the revised proposal, draft a precise follow-up, and plant a Monday checkpoint. External send stays behind approval.",
      outcome === "AUTO" ? "approved" : outcome.toLowerCase(),
      "planner-v1",
      now,
    ],
  );

  const actions = [
    {
      id: IDS.actPrepare,
      type: "prepare_proposal",
      title: "Prepare revised proposal",
      description: "Assemble the 320,000 DZD revised proposal for Atlas Retail (warehouse fit-out Q4).",
      payload: { document: "proposal_v2", amount: 320000, currency: "DZD", strategy: "personalized_followup" },
      policy: prepare,
    },
    {
      id: IDS.actDraft,
      type: "draft_message",
      title: "Draft apology / follow-up",
      description:
        "Amine — the revised 320K proposal is ready. We missed Thursday. Decision still yours this week; I can walk you through it today.",
      payload: {
        to: "Amine Khelifi",
        subject: "Revised Atlas proposal — 320,000 DZD",
        body: "Amine — you asked for the revised 320,000 DZD proposal and promised a Friday decision. We missed our Thursday send. The revision is ready now. If useful I can walk you through the changes today so your decision is unblocked.",
        strategy: "personalized_followup",
      },
      policy: draft,
    },
    {
      id: IDS.actCheck,
      type: "create_checkpoint",
      title: "Create follow-up checkpoint",
      description: "Monday 28 Sep 10:00 — confirm proposal received and decision still expected.",
      payload: { dueAt: CHECKPOINT_ISO },
      policy: check,
    },
  ];

  for (const action of actions) {
    run(
      db,
      `INSERT INTO actions (id, exception_id, plan_id, type, title, description, payload, policy_outcome, policy_reason, status, evidence_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        action.id,
        exceptionId,
        IDS.planRecovery,
        action.type,
        action.title,
        action.description,
        JSON.stringify(action.payload),
        action.policy.outcome,
        action.policy.reason,
        "proposed",
        JSON.stringify({ source: "recovery-engine", exceptionId }),
        now,
      ],
    );
  }

  run(db, "UPDATE exceptions SET status = ? WHERE id = ?", ["planned", exceptionId]);
  return one<PlanRow>(db, "SELECT * FROM plans WHERE id = ?", [IDS.planRecovery])!;
}

export function buildDiscountAlternative(db: DatabaseSync, exceptionId: string, now: string): PlanRow {
  const existing = one<PlanRow>(db, "SELECT * FROM plans WHERE exception_id = ?", [exceptionId]);
  if (existing) return existing;

  const policies = loadPolicies(db);
  const blocked = evaluatePolicy({ type: "apply_discount", payload: { percent: 10 } }, policies);
  const offer5 = evaluatePolicy({ type: "apply_discount", payload: { percent: 5 } }, policies);
  const terms = evaluatePolicy({ type: "offer_alternative", payload: { terms: "net-14" } }, policies);
  const draft = evaluatePolicy({ type: "draft_message", payload: { audience: "customer" } }, policies);

  run(
    db,
    `INSERT INTO plans (id, exception_id, title, summary, status, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      IDS.planDiscount,
      exceptionId,
      "Policy-safe close for Atlas",
      "10% is blocked. Offer the 5% ceiling plus faster payment terms so Amine can still sign today.",
      "blocked",
      "planner-v1",
      now,
    ],
  );

  const actions = [
    {
      id: IDS.actDiscount,
      type: "apply_discount",
      title: "Apply 10% discount",
      description: "Customer asked for 10% to sign today. Policy forbids it.",
      payload: { percent: 10, amount: 320000 },
      policy: blocked,
      status: "blocked",
    },
    {
      id: IDS.actAlt5,
      type: "apply_discount",
      title: "Alternative — offer 5% (policy max)",
      description: "320,000 → 304,000 DZD. Stays inside discount_max=5%.",
      payload: { percent: 5, amount: 304000 },
      policy: offer5,
      status: "proposed",
    },
    {
      id: IDS.actAltTerms,
      type: "offer_alternative",
      title: "Alternative — Net-14 + priority slot",
      description: "Keep list price, pull delivery forward one week, invoice Net-14.",
      payload: { terms: "net-14", expediteDays: 7 },
      policy: terms,
      status: "proposed",
    },
    {
      id: IDS.actAltDraft,
      type: "draft_message",
      title: "Draft policy-safe reply",
      description:
        "I can sign 5% today (304,000 DZD) or keep 320,000 with a one-week pull-in and Net-14. 10% is outside what I can authorize.",
      payload: {
        to: "Amine Khelifi",
        body: "Amine — I can meet you today. 10% is outside our authorization. I can do 5% (304,000 DZD) immediately, or keep 320,000 and pull the install slot forward a week with Net-14. Which path do you want?",
      },
      policy: draft,
      status: "proposed",
    },
  ];

  for (const action of actions) {
    run(
      db,
      `INSERT INTO actions (id, exception_id, plan_id, type, title, description, payload, policy_outcome, policy_reason, status, evidence_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        action.id,
        exceptionId,
        IDS.planDiscount,
        action.type,
        action.title,
        action.description,
        JSON.stringify(action.payload),
        action.policy.outcome,
        action.policy.reason,
        action.status,
        JSON.stringify({ source: "policy-engine", quote: "I'll sign today if you give me 10%." }),
        now,
      ],
    );
  }

  return one<PlanRow>(db, "SELECT * FROM plans WHERE id = ?", [IDS.planDiscount])!;
}

export function getPlanBundle(db: DatabaseSync, exceptionId: string) {
  const plan = one<PlanRow>(db, "SELECT * FROM plans WHERE exception_id = ?", [exceptionId]);
  const actions = all<ActionRow>(db, "SELECT * FROM actions WHERE exception_id = ? ORDER BY created_at", [exceptionId]);
  const exception = one<ExceptionRow>(db, "SELECT * FROM exceptions WHERE id = ?", [exceptionId]);
  const historicalEvidence = exception ? evidenceForCompatibleKind(db, exception.kind) : null;
  return {
    plan,
    actions: actions.map((a) => ({ ...a, payload: JSON.parse(a.payload) })),
    historicalEvidence,
  };
}
