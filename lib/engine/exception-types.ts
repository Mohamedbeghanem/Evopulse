/** PLAN §5 exception types. Software assigns these — never an LLM. */
export const EXCEPTION_TYPES = {
  MISSED_COMMITMENT: "missed_commitment",
  LATE_PAYMENT: "late_payment",
  MISSING_RESPONSE: "missing_response",
  DELIVERY_DELAY: "delivery_delay",
  GOAL_DRIFT: "goal_drift",
  DEPENDENCY_FAILURE: "dependency_failure",
  UNEXPECTED_CHANGE: "unexpected_change",
} as const;

export type CanonicalExceptionType = (typeof EXCEPTION_TYPES)[keyof typeof EXCEPTION_TYPES];

/** Seed-era Pulse used `commitment_missed`. Canonical PLAN name is `missed_commitment`. */
export const EXCEPTION_TYPE_ALIASES: Record<string, string> = {
  commitment_missed: EXCEPTION_TYPES.MISSED_COMMITMENT,
  missed_commitment: EXCEPTION_TYPES.MISSED_COMMITMENT,
};

export function canonicalExceptionType(kind: string): string {
  return EXCEPTION_TYPE_ALIASES[kind] || kind;
}

export function exceptionTypeMatches(kind: string, canonical: string): boolean {
  return canonicalExceptionType(kind) === canonicalExceptionType(canonical);
}

export function isMissedCommitment(kind: string): boolean {
  return canonicalExceptionType(kind) === EXCEPTION_TYPES.MISSED_COMMITMENT;
}

export const EXPECTATION_SOURCES = [
  "commitment",
  "contract",
  "workflow",
  "goal",
  "historical_pattern",
  "manual",
  "verification",
] as const;
