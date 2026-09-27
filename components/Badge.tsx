const BAD = "bg-bad-bg text-bad";
const WARN = "bg-warn-bg text-warn";
const OK = "bg-ok-bg text-ok";
const TEAL = "bg-teal-bg text-teal";
const NEUTRAL = "bg-[#E8EEF0] text-ink";

const TONES: Record<string, string> = {
  NEEDS_YOU: BAD,
  MONITORING: WARN,
  HANDLED: OK,
  HEALTHY: OK,
  MISSED: BAD,
  BLOCKED: BAD,
  FULFILLED: OK,
  AT_RISK: WARN,
  TIGHT: WARN,
  SAFE: OK,
  "NOT MISSED": TEAL,
  CRITICAL: BAD,
  HIGH: WARN,
  MEDIUM: TEAL,
  LOW: NEUTRAL,
  RESOLVED: OK,
  ESCALATED: BAD,
  DISMISSED: NEUTRAL,
  OBSERVED: TEAL,
  CALCULATED: WARN,
  DEPENDENCY: WARN,
  HISTORICAL: OK,
  ASSUMPTION: NEUTRAL,
  AI_INTERPRETATION: NEUTRAL,
  APPROVAL_REQUIRED: WARN,
  AUTO: TEAL,
  open: BAD,
  planned: TEAL,
  approved: TEAL,
  resolved: OK,
  proposed: NEUTRAL,
  executed: OK,
  blocked: BAD,
  awaiting_verification: WARN,
  PENDING: WARN,
  SUCCESS: OK,
  FAILED: BAD,
  CANCELLED: NEUTRAL,
  NORMAL: NEUTRAL,
  PREPARED: TEAL,
  AUTO_HANDLED: OK,
  NEEDS_APPROVAL: WARN,
  RELIABLE_PATTERN: OK,
  EMERGING_PATTERN: TEAL,
  INSUFFICIENT_DATA: NEUTRAL,
  ACTIVE: WARN,
  DRAFT: NEUTRAL,
  COMPLETED: OK,
  OBSERVED_FACT: TEAL,
  CALCULATED_IMPACT: WARN,
  HISTORICAL_EVIDENCE: OK,
  POLICY_DECISION: NEUTRAL,
  AI_RECOMMENDATION: NEUTRAL,
  SUSPENDED: BAD,
};

export function Badge({ children }: { children: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-semibold tracking-[0.04em] ${
        TONES[children] || NEUTRAL
      }`}
    >
      {children.replaceAll("_", " ")}
    </span>
  );
}
