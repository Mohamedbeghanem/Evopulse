import type { ExceptionRow } from "../types";
import type { ContextFields } from "./types";

/** Stable, comparable situations. Do not put customer IDs in the signature. */
export const SEED_FOLLOWUP_CONTEXT: ContextFields = {
  problem_type: "stale_opportunity",
  customer_type: "existing",
  value_band: "250k-500k",
  silence_band: "3-7d",
};

export const COMPATIBLE_EXCEPTION_KINDS = new Set([
  "commitment_missed",
  "stale_opportunity",
  "customer_no_response",
  "missing_response",
]);

export function buildContextSignature(fields: ContextFields): string {
  return [
    `problem:${fields.problem_type}`,
    `customer_type:${fields.customer_type}`,
    `value_band:${fields.value_band}`,
    `silence_band:${fields.silence_band}`,
  ].join("|");
}

export const SEED_FOLLOWUP_SIGNATURE = buildContextSignature(SEED_FOLLOWUP_CONTEXT);

export function valueBand(amount: number): string {
  if (amount < 250000) return "under_250k";
  if (amount <= 500000) return "250k-500k";
  return "500k_plus";
}

export function mapExceptionKindToProblem(kind: string): string {
  if (kind === "commitment_missed" || kind === "missing_response" || kind === "customer_no_response") {
    return "stale_opportunity";
  }
  return kind;
}

export function isLearningCompatibleKind(kind: string): boolean {
  return COMPATIBLE_EXCEPTION_KINDS.has(kind);
}

export function contextFromException(exception: ExceptionRow): ContextFields {
  let amount = 320000;
  try {
    const impact = JSON.parse(exception.impact_json) as { revenueAssociated?: number };
    if (typeof impact.revenueAssociated === "number") amount = impact.revenueAssociated;
  } catch {
    /* keep default */
  }
  return {
    problem_type: mapExceptionKindToProblem(exception.kind),
    customer_type: "existing",
    value_band: valueBand(amount),
    silence_band: "3-7d",
  };
}

export function signatureFromException(exception: ExceptionRow): string {
  return buildContextSignature(contextFromException(exception));
}
