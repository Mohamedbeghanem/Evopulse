/**
 * Timeline tape kinds (salvaged from closed PR #35, lib/ui/event-kind.ts, and tightened).
 * Presentation only: classifies an Event Layer row for the Timeline. It reads no state and
 * decides nothing — engines own truth; this only labels what the stream already says.
 *
 * Deliberate differences from #35:
 * - A customer reply is OBSERVED evidence, not VERIFIED. Only the verification engine verifies.
 * - Effects written by the action engine (quote.sent, task.completed, …) are EXECUTED.
 * - A failed verification is DETECTED, never VERIFIED.
 */
export type TapeKind = "EXPECTED" | "OBSERVED" | "DETECTED" | "PLANNED" | "EXECUTED" | "VERIFIED";

export const TAPE_KINDS: TapeKind[] = ["EXPECTED", "OBSERVED", "DETECTED", "PLANNED", "EXECUTED", "VERIFIED"];

const EXPECTED_TYPES = new Set(["shipment.expected", "payment.expected", "commitment.created", "verification.created"]);
const DETECTED_TYPES = new Set([
  "commitment.missed",
  "exception.created",
  "dependency.cascade",
  "order.affected",
  "policy.blocked",
  "verification.failed",
]);
const PLANNED_TYPES = new Set(["goal.created", "action.proposed", "approval.requested", "autonomy.promotion_candidate"]);

export function tapeKindForEvent(type: string, source?: string | null): TapeKind {
  if (type === "verification.resolved") return "VERIFIED";
  if (DETECTED_TYPES.has(type) || type.startsWith("warning.") || type.startsWith("exception.")) return "DETECTED";
  if (type === "action.executed" || source === "action-engine") return "EXECUTED";
  if (EXPECTED_TYPES.has(type) || type.startsWith("expectation.")) return "EXPECTED";
  if (PLANNED_TYPES.has(type) || type.startsWith("plan.")) return "PLANNED";
  return "OBSERVED";
}
