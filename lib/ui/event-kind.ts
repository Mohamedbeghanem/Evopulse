export type TapeKind = "EXPECTED" | "OBSERVED" | "DETECTED" | "PLANNED" | "EXECUTED" | "VERIFIED";

export function tapeKindForEvent(type: string): TapeKind {
  if (
    type.endsWith(".expected") ||
    type === "payment.expected" ||
    type === "shipment.expected" ||
    type.includes("expectation.created")
  ) {
    return "EXPECTED";
  }
  if (type === "action.executed" || type === "plan.executed") return "EXECUTED";
  if (type.includes("verif") || type.includes("outcome") || type === "customer.replied") return "VERIFIED";
  if (type.includes("plan") || type === "action.proposed" || type === "goal.created") return "PLANNED";
  if (
    type.includes("exception") ||
    type.includes("missed") ||
    type.includes("cascade") ||
    type === "policy.blocked" ||
    type === "shipment.delayed"
  ) {
    return "DETECTED";
  }
  return "OBSERVED";
}

export function tapeKindForExpectation(status: string): TapeKind {
  if (status === "MISSED" || status === "BLOCKED") return "DETECTED";
  if (status === "FULFILLED") return "VERIFIED";
  return "EXPECTED";
}
