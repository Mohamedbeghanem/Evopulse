const TONES: Record<string, string> = {
  NEEDS_YOU: "bg-need text-ink-950",
  MONITORING: "bg-ice/20 text-ice",
  HANDLED: "bg-ok/20 text-ok",
  HEALTHY: "bg-white/10 text-sand",
  MISSED: "bg-miss/20 text-miss",
  BLOCKED: "bg-miss/20 text-miss",
  FULFILLED: "bg-ok/20 text-ok",
  AT_RISK: "bg-need/20 text-need",
  APPROVAL_REQUIRED: "bg-need/20 text-need",
  AUTO: "bg-ok/20 text-ok",
  open: "bg-need/20 text-need",
  planned: "bg-ice/20 text-ice",
  approved: "bg-ice/20 text-ice",
  resolved: "bg-ok/20 text-ok",
  proposed: "bg-white/10 text-sand",
  executed: "bg-ok/20 text-ok",
  blocked: "bg-miss/20 text-miss",
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
