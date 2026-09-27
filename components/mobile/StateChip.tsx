const TONE: Record<string, string> = {
  BLOCKED: "border-need/60 text-need",
  NEEDS_YOU: "border-need/60 text-need",
  NEEDS_APPROVAL: "border-watch/60 text-watch",
  APPROVAL_REQUIRED: "border-watch/60 text-watch",
  MONITORING: "border-ice/50 text-ice",
  PENDING: "border-ice/50 text-ice",
  HANDLED: "border-ok/60 text-ok",
  SUCCESS: "border-ok/60 text-ok",
  AUTO: "border-hairline text-sand",
};

export function StateChip({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${TONE[value] || "border-hairline text-sand"}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
