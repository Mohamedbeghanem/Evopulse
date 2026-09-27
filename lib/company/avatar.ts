import type { AgentPhase, AgentRunStatus } from "../agent/types";

export const PULSE_AVATAR_STATES = [
  "IDLE",
  "THINKING",
  "INVESTIGATING",
  "WAITING_FOR_APPROVAL",
  "EXECUTING",
  "VERIFYING",
  "SUCCESS",
  "BLOCKED",
] as const;

export type PulseAvatarState = (typeof PULSE_AVATAR_STATES)[number];

const PHASE_TO_AVATAR: Record<AgentPhase, PulseAvatarState> = {
  IDLE: "IDLE",
  INTERPRETING: "THINKING",
  RUNNING_TOOL: "INVESTIGATING",
  WAITING_FOR_TOOL: "INVESTIGATING",
  WAITING_FOR_APPROVAL: "WAITING_FOR_APPROVAL",
  EXECUTING: "EXECUTING",
  VERIFYING: "VERIFYING",
  COMPLETE: "SUCCESS",
  FAILED: "BLOCKED",
  CANCELLED: "BLOCKED",
};

export function avatarStateFromAgent(
  phase?: string | null,
  status?: AgentRunStatus | string | null,
): PulseAvatarState {
  if (status === "waiting_for_approval") return "WAITING_FOR_APPROVAL";
  if (status === "failed" || status === "cancelled") return "BLOCKED";
  if (phase && phase in PHASE_TO_AVATAR) return PHASE_TO_AVATAR[phase as AgentPhase];
  return "IDLE";
}

export function avatarLabel(state: PulseAvatarState): string {
  switch (state) {
    case "THINKING":
      return "Understanding";
    case "INVESTIGATING":
      return "Investigating";
    case "WAITING_FOR_APPROVAL":
      return "Waiting for approval";
    case "EXECUTING":
      return "Executing";
    case "VERIFYING":
      return "Verifying";
    case "SUCCESS":
      return "Handled";
    case "BLOCKED":
      return "Blocked";
    default:
      return "Listening";
  }
}
