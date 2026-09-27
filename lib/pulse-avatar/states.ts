export const PULSE_AVATAR_STATES = [
  "IDLE",
  "LISTENING",
  "THINKING",
  "INVESTIGATING",
  "MONITORING",
  "ACTION_READY",
  "WAITING_FOR_YOU",
  "BLOCKED",
  "EXECUTING",
  "VERIFYING",
  "SUCCESS",
  "ERROR",
] as const;

export type PulseAvatarState = (typeof PULSE_AVATAR_STATES)[number];

export const PULSE_AVATAR_LABELS: Record<PulseAvatarState, string> = {
  IDLE: "Pulse is ready",
  LISTENING: "Pulse is listening",
  THINKING: "Pulse is thinking",
  INVESTIGATING: "Pulse is investigating",
  MONITORING: "Pulse is monitoring",
  ACTION_READY: "Pulse has something ready",
  WAITING_FOR_YOU: "Pulse is waiting for you",
  BLOCKED: "Pulse is blocked",
  EXECUTING: "Pulse is executing",
  VERIFYING: "Pulse is verifying",
  SUCCESS: "Pulse finished",
  ERROR: "Pulse is offline",
};

const RUNTIME_TO_AVATAR: Record<string, PulseAvatarState> = {
  IDLE: "IDLE",
  INTERPRETING: "THINKING",
  RUNNING_TOOL: "INVESTIGATING",
  WAITING_FOR_TOOL: "INVESTIGATING",
  WAITING_FOR_APPROVAL: "WAITING_FOR_YOU",
  EXECUTING: "EXECUTING",
  VERIFYING: "VERIFYING",
  COMPLETE: "SUCCESS",
  FAILED: "ERROR",
  CANCELLED: "ERROR",
};

export function avatarStateFromRuntime(phase?: string | null): PulseAvatarState {
  if (!phase) return "IDLE";
  return RUNTIME_TO_AVATAR[phase] ?? "IDLE";
}

export const PULSE_INTRO =
  "I'm Pulse. I watch what your business expects to happen, notice when reality changes, and help coordinate what happens next. I'll handle what I'm allowed to handle. I'll ask you when a decision needs your authority. And I'll verify what happened afterward.";
