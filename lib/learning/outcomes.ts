import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { eventsFor } from "../events";
import { id } from "../ids";
import type { ActionRow, ExceptionRow } from "../types";
import { contextFromException, signatureFromException } from "./context";
import { LEARNING_EVENT_TYPES, inferStrategyFromAction } from "./verification";
import { secondsBetween } from "./time";
import type { OutcomeRow, VerificationRow } from "./types";

export class OutcomeLedger {
  constructor(private readonly db: DatabaseSync) {}

  static for(db: DatabaseSync) {
    return new OutcomeLedger(db);
  }

  record(input: {
    problem_type: string;
    context_signature: string;
    exception_id?: string | null;
    plan_id?: string | null;
    action_id?: string | null;
    verification_id?: string | null;
    strategy: string;
    result: string;
    success: boolean;
    time_to_result?: number | null;
    business_effect?: string;
    policy_state?: string;
    human_feedback?: string | null;
    created_at: string;
    id?: string;
  }): OutcomeRow {
    const rowId = input.id || id("out");
    run(
      this.db,
      `INSERT INTO outcomes
        (id, problem_type, context_signature, exception_id, plan_id, action_id, verification_id,
         strategy, result, success, time_to_result, business_effect, policy_state, human_feedback, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rowId,
        input.problem_type,
        input.context_signature,
        input.exception_id ?? null,
        input.plan_id ?? null,
        input.action_id ?? null,
        input.verification_id ?? null,
        input.strategy,
        input.result,
        input.success ? 1 : 0,
        input.time_to_result ?? null,
        input.business_effect ?? "",
        input.policy_state ?? "",
        input.human_feedback ?? null,
        input.created_at,
      ],
    );
    return this.getById(rowId)!;
  }

  recordFromVerification(verification: VerificationRow, now: string): OutcomeRow | null {
    const existing = one<OutcomeRow>(
      this.db,
      "SELECT * FROM outcomes WHERE verification_id = ?",
      [verification.id],
    );
    if (existing) return existing;
    if (verification.status === "PENDING" || verification.status === "CANCELLED") return null;

    const action = one<ActionRow>(this.db, "SELECT * FROM actions WHERE id = ?", [verification.action_id]);
    const exception = one<ExceptionRow>(this.db, "SELECT * FROM exceptions WHERE id = ?", [
      verification.exception_id,
    ]);
    const meta = safeJson(verification.metadata);
    const strategy =
      (typeof meta.strategy === "string" && meta.strategy) ||
      (action ? inferStrategyFromAction(action) : "generic_followup");
    const fields = exception ? contextFromException(exception) : null;

    const outcome = this.record({
      problem_type: fields?.problem_type || "stale_opportunity",
      context_signature: exception ? signatureFromException(exception) : "",
      exception_id: verification.exception_id,
      plan_id: action?.plan_id ?? null,
      action_id: verification.action_id,
      verification_id: verification.id,
      strategy,
      result: verification.status === "SUCCESS" ? "customer_replied" : "no_response",
      success: verification.status === "SUCCESS",
      time_to_result: secondsBetween(verification.created_at, verification.resolved_at || now),
      business_effect:
        verification.status === "SUCCESS"
          ? "Customer responded after the executed action."
          : "No matching customer response before the verification deadline.",
      policy_state: action?.policy_outcome || "",
      created_at: now,
    });

    eventsFor(this.db).append({
      type: LEARNING_EVENT_TYPES.OUTCOME_RECORDED,
      source: "outcome-ledger",
      source_id: outcome.id,
      entity_type: "outcome",
      entity_id: outcome.id,
      payload: {
        strategy: outcome.strategy,
        success: Boolean(outcome.success),
        result: outcome.result,
        verificationId: verification.id,
        synthetic: false,
      },
      occurred_at: now,
      received_at: now,
      confidence: 1,
      idempotent: true,
    });

    return outcome;
  }

  getById(outcomeId: string): OutcomeRow | undefined {
    return one<OutcomeRow>(this.db, "SELECT * FROM outcomes WHERE id = ?", [outcomeId]);
  }

  listByContext(contextSignature: string): OutcomeRow[] {
    return all<OutcomeRow>(
      this.db,
      "SELECT * FROM outcomes WHERE context_signature = ? ORDER BY created_at, id",
      [contextSignature],
    );
  }

  listByStrategy(contextSignature: string, strategy: string): OutcomeRow[] {
    return all<OutcomeRow>(
      this.db,
      "SELECT * FROM outcomes WHERE context_signature = ? AND strategy = ? ORDER BY created_at, id",
      [contextSignature, strategy],
    );
  }
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
