"use client";

import { useEffect, useId, useState } from "react";
import type { AgentTone } from "./catalog";

export type AgentAvatarState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "INVESTIGATING"
  | "MONITORING"
  | "WAITING_FOR_APPROVAL"
  | "EXECUTING"
  | "VERIFYING"
  | "SUCCESS"
  | "BLOCKED"
  | "ERROR"
  | "OFFLINE";

export type AgentAvatarSize = "xs" | "sm" | "md" | "lg" | "hero";

const PX: Record<AgentAvatarSize, number> = { xs: 16, sm: 24, md: 32, lg: 48, hero: 96 };

const FILL: Record<AgentTone, string> = {
  slate: "#5C6B73",
  orange: "#EC6025",
  violet: "#5B5478",
};

const STATUS_LABEL: Record<AgentAvatarState, string> = {
  IDLE: "Idle",
  LISTENING: "Listening",
  THINKING: "Thinking",
  INVESTIGATING: "Investigating",
  MONITORING: "Monitoring",
  WAITING_FOR_APPROVAL: "Waiting for approval",
  EXECUTING: "Executing",
  VERIFYING: "Verifying",
  SUCCESS: "Complete",
  BLOCKED: "Blocked",
  ERROR: "Failed",
  OFFLINE: "Offline",
};

type Motion = { speed: number; amp: number };

const MOTION: Record<AgentAvatarState, Motion> = {
  IDLE: { speed: 0.55, amp: 0.035 },
  LISTENING: { speed: 0.7, amp: 0.05 },
  THINKING: { speed: 0.32, amp: 0.09 },
  INVESTIGATING: { speed: 0.85, amp: 0.07 },
  MONITORING: { speed: 0.42, amp: 0.045 },
  WAITING_FOR_APPROVAL: { speed: 0.18, amp: 0.02 },
  EXECUTING: { speed: 1.15, amp: 0.07 },
  VERIFYING: { speed: 0.95, amp: 0.04 },
  SUCCESS: { speed: 0.6, amp: 0.05 },
  BLOCKED: { speed: 0, amp: 0 },
  ERROR: { speed: 0, amp: 0 },
  OFFLINE: { speed: 0, amp: 0 },
};

function blobPath(time: number, state: AgentAvatarState, reduced: boolean) {
  const motion = reduced ? { speed: 0, amp: 0 } : MOTION[state];
  const count = 8;
  const points: [number, number][] = [];
  const blocked = state === "BLOCKED" || state === "OFFLINE";
  const errorNudge = state === "ERROR" && !reduced && time % 2.4 < 0.28 ? 0.06 : 0;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const side = i % 2 === 0 ? 1 : 0.55;
    const wave = Math.sin(time * motion.speed + i * 0.85) * motion.amp * side;
    const radius = (blocked ? 16.5 : 20.5) * (1 + wave + errorNudge);
    const squash = state === "VERIFYING" && !reduced ? 0.9 + 0.06 * Math.sin(time * 1.4) : 1;
    points.push([32 + Math.cos(angle) * radius, 32 + Math.sin(angle) * radius * squash]);
  }
  let path = "";
  for (let i = 0; i < count; i++) {
    const current = points[i];
    const next = points[(i + 1) % count];
    const after = points[(i + 2) % count];
    const midX = (next[0] + after[0]) / 2;
    const midY = (next[1] + after[1]) / 2;
    if (i === 0) {
      const startX = (current[0] + next[0]) / 2;
      const startY = (current[1] + next[1]) / 2;
      path += `M ${startX.toFixed(2)} ${startY.toFixed(2)} `;
    }
    path += `Q ${next[0].toFixed(2)} ${next[1].toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)} `;
  }
  path += "Z";
  path += " M 32 26.5 L 35.2 32 L 32 37.5 L 28.8 32 Z";
  return path;
}

export function AgentAvatar({
  agent,
  state,
  size = "sm",
  label,
}: {
  agent: { name: string; tone: AgentTone };
  state: AgentAvatarState;
  size?: AgentAvatarSize;
  label?: boolean;
}) {
  const rawId = useId();
  const titleId = `${rawId.replace(/:/g, "")}-avatar`;
  const [reduced, setReduced] = useState(false);
  const [time, setTime] = useState(0);
  const px = PX[size];
  const status = STATUS_LABEL[state];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduced || state === "BLOCKED" || state === "OFFLINE") return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      setTime((now - started) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, state]);

  return (
    <span className="inline-flex items-center gap-2" style={{ color: FILL[agent.tone] }}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        role="img"
        aria-labelledby={titleId}
        className={state === "OFFLINE" ? "opacity-45" : undefined}
      >
        <title id={titleId}>
          {agent.name}, {status}
        </title>
        <path d={blobPath(time, state, reduced)} fill="currentColor" fillRule="evenodd" />
      </svg>
      {label ? <span className="text-[12px] font-medium leading-none">{status}</span> : null}
    </span>
  );
}

export function agentStatusLabel(state: AgentAvatarState) {
  return STATUS_LABEL[state];
}

export function agentShowsActivity(state: AgentAvatarState) {
  return state !== "IDLE" && state !== "OFFLINE" && state !== "SUCCESS";
}
