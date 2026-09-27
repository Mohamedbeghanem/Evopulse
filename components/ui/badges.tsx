const ATTENTION: Record<string, string> = {
  NEEDS_YOU: "text-need",
  NEEDS_APPROVAL: "text-need",
  BLOCKED: "text-mute",
  MONITORING: "text-watch",
  HANDLED: "text-ice",
  HEALTHY: "text-sand",
  AUTO: "text-ice",
  AUTO_HANDLED: "text-ice",
  APPROVAL_REQUIRED: "text-need",
  POLICY: "text-sand",
  PENDING: "text-ice",
  SUCCESS: "text-ice",
  FAILED: "text-miss",
  AT_RISK: "text-need",
  EXPECTED: "text-sand",
  OBSERVED: "text-paper",
  DETECTED: "text-need",
  PLANNED: "text-ice",
  EXECUTED: "text-watch",
  VERIFIED: "text-ice",
  LIVE: "text-paper",
  SIMULATION: "text-ice",
  DELTA: "text-watch",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${ATTENTION[value] || "text-sand"}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function PolicyBadge({ outcome }: { outcome: string }) {
  return <StatusBadge value={outcome} />;
}

export function VerificationBadge({ status }: { status: string }) {
  return <StatusBadge value={status} />;
}

export function attentionTone(value: string) {
  return ATTENTION[value] || "text-sand";
}
