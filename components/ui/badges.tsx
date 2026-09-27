const ATTENTION: Record<string, string> = {
  NEEDS_YOU: "text-bad",
  NEEDS_APPROVAL: "text-warn",
  BLOCKED: "text-bad",
  MONITORING: "text-warn",
  HANDLED: "text-ok",
  HEALTHY: "text-ok",
  AUTO: "text-teal",
  AUTO_HANDLED: "text-teal",
  APPROVAL_REQUIRED: "text-warn",
  POLICY: "text-muted",
  PENDING: "text-warn",
  SUCCESS: "text-ok",
  FAILED: "text-bad",
  AT_RISK: "text-warn",
  EXPECTED: "text-muted",
  OBSERVED: "text-ink",
  DETECTED: "text-bad",
  PLANNED: "text-teal",
  EXECUTED: "text-teal",
  VERIFIED: "text-ok",
  LIVE: "text-ok",
  SIMULATION: "text-teal",
  DELTA: "text-warn",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${ATTENTION[value] || "text-muted"}`}>
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
  return ATTENTION[value] || "text-muted";
}
