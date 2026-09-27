const TONES: Record<string, string> = {
  NEEDS_YOU: "bg-need text-ink-950",
  MONITORING: "bg-ice/20 text-ice",
  HANDLED: "bg-ok/20 text-ok",
  HEALTHY: "bg-white/10 text-sand",
  MISSED: "bg-miss/20 text-miss",
  BLOCKED: "bg-miss/20 text-miss",
  FULFILLED: "bg-ok/20 text-ok",
  AT_RISK: "bg-need/20 text-need",
  TIGHT: "bg-need/15 text-need",
  SAFE: "bg-ok/20 text-ok",
  CRITICAL: "bg-miss/20 text-miss",
  HIGH: "bg-need/20 text-need",
  ACTIVE: "bg-need/20 text-need",
  RESOLVED: "bg-ok/20 text-ok",
  TRANSITIONED: "bg-miss/20 text-miss",
  APPROVAL_REQUIRED: "bg-need/20 text-need",
  AUTO: "bg-ok/20 text-ok",
  open: "bg-need/20 text-need",
  planned: "bg-ice/20 text-ice",
  approved: "bg-ice/20 text-ice",
  resolved: "bg-ok/20 text-ok",
  proposed: "bg-white/10 text-sand",
  executed: "bg-ok/20 text-ok",
  blocked: "bg-miss/20 text-miss",
  awaiting_verification: "bg-ice/20 text-ice",
  PENDING: "bg-ice/20 text-ice",
  SUCCESS: "bg-ok/20 text-ok",
  FAILED: "bg-miss/20 text-miss",
  CANCELLED: "bg-white/10 text-sand",
  RELIABLE_PATTERN: "bg-ok/20 text-ok",
  EMERGING_PATTERN: "bg-ice/20 text-ice",
  INSUFFICIENT_DATA: "bg-white/10 text-sand",
};

export function Badge({ children }: { children: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
        TONES[children] || "bg-white/10 text-sand"
      }`}
    >
      {children.replaceAll("_", " ")}
    </span>
  );
}
