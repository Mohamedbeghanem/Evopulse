"use client";

import { avatarLabel, type PulseAvatarState } from "@/lib/company";

const TONE: Record<PulseAvatarState, string> = {
  IDLE: "avatar-idle",
  THINKING: "avatar-think",
  INVESTIGATING: "avatar-investigate",
  WAITING_FOR_APPROVAL: "avatar-wait",
  EXECUTING: "avatar-execute",
  VERIFYING: "avatar-verify",
  SUCCESS: "avatar-success",
  BLOCKED: "avatar-blocked",
};

export function PulseAvatar({
  state = "IDLE",
  size = "md",
  caption,
}: {
  state?: PulseAvatarState;
  size?: "sm" | "md" | "lg";
  caption?: string;
}) {
  const dim = size === "lg" ? 168 : size === "sm" ? 56 : 96;
  return (
    <figure className="flex flex-col items-center gap-3" aria-live="polite">
      <div
        className={`pulse-avatar ${TONE[state]}`}
        style={{ width: dim, height: dim }}
        role="img"
        aria-label={`Pulse is ${avatarLabel(state)}`}
      >
        <span className="pulse-avatar-core" />
        <span className="pulse-avatar-ring" />
        <span className="pulse-avatar-glint" />
      </div>
      <figcaption className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">
        {caption || avatarLabel(state)}
      </figcaption>
    </figure>
  );
}
