import type { ProjectedAttention } from "@/lib/ui/attention";

const ATTENTION: Record<string, string> = {
  NEEDS_YOU: "text-need",
  NEEDS_APPROVAL: "text-need",
  BLOCKED: "text-mute",
  MONITORING: "text-ice",
  HANDLED: "text-ok",
  HEALTHY: "text-sand",
  AUTO: "text-ice",
  APPROVAL_REQUIRED: "text-need",
  PENDING: "text-ice",
  SUCCESS: "text-ok",
  FAILED: "text-miss",
  AT_RISK: "text-need",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${ATTENTION[value] || "text-sand"}`}>
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

export function attentionTone(value: ProjectedAttention | string) {
  return ATTENTION[value] || "text-sand";
}
