"use client";

import { BloubMark, type BloubMood } from "@/components/agent/BloubMark";

export type PulseAgentState =
  | "IDLE"
  | "THINKING"
  | "INVESTIGATING"
  | "MONITORING"
  | "WAITING_FOR_APPROVAL"
  | "EXECUTING"
  | "VERIFYING"
  | "SUCCESS"
  | "BLOCKED"
  | "ERROR";

const LABEL: Record<PulseAgentState, string> = {
  IDLE: "Ready",
  THINKING: "Thinking",
  INVESTIGATING: "Investigating",
  MONITORING: "Monitoring",
  WAITING_FOR_APPROVAL: "Waiting for approval",
  EXECUTING: "Executing",
  VERIFYING: "Verifying",
  SUCCESS: "Complete",
  BLOCKED: "Blocked",
  ERROR: "Failed",
};

const TONE: Record<PulseAgentState, string> = {
  IDLE: "text-muted",
  THINKING: "text-teal",
  INVESTIGATING: "text-teal",
  MONITORING: "text-warn",
  WAITING_FOR_APPROVAL: "text-warn",
  EXECUTING: "text-ink",
  VERIFYING: "text-teal",
  SUCCESS: "text-ok",
  BLOCKED: "text-bad",
  ERROR: "text-bad",
};

function token(value?: string) {
  return (value ?? "").trim().toUpperCase();
}

export function phaseToPulseState(phase?: string, status?: string): PulseAgentState {
  const step = token(phase);
  const run = token(status);

  if (run === "BLOCKED") return "BLOCKED";
  if (step === "COMPLETE" || run === "COMPLETE") return "SUCCESS";
  if (step === "FAILED" || run === "FAILED") return "ERROR";
  if (step === "CANCELLED" || run === "CANCELLED") return "IDLE";
  if (step === "INTERPRETING") return "THINKING";
  if (step === "RUNNING" || step === "RUNNING_TOOL" || step === "WAITING_FOR_TOOL") return "INVESTIGATING";
  if (step === "WAITING_FOR_APPROVAL" || run === "WAITING_FOR_APPROVAL") return "WAITING_FOR_APPROVAL";
  if (step === "EXECUTING") return "EXECUTING";
  if (step === "VERIFYING") return "VERIFYING";
  return "IDLE";
}

function moodFor(state: PulseAgentState): BloubMood {
  if (state === "THINKING" || state === "INVESTIGATING" || state === "VERIFYING") return "thinking";
  if (state === "EXECUTING") return "speaking";
  return "idle";
}

export function PulseAgent({
  state,
  size,
  showLabel,
}: {
  state: PulseAgentState;
  size?: number;
  showLabel?: boolean;
}) {
  const label = LABEL[state];

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 transition-[color,opacity] duration-[220ms] ease-out motion-reduce:transition-none ${TONE[state]}`}
    >
      <BloubMark size={size} mood={moodFor(state)} title="Pulse" />
      {showLabel === false ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="whitespace-nowrap text-[12px] font-medium leading-none">{label}</span>
      )}
    </span>
  );
}
