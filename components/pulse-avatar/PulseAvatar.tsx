"use client";

import { useEffect, useState } from "react";
import {
  PULSE_AVATAR_LABELS,
  type PulseAvatarState,
} from "@/lib/pulse-avatar/states";

const SIZES = {
  24: 24,
  32: 32,
  48: 48,
  96: 96,
  hero: 168,
} as const;

export function PulseAvatar({
  state = "IDLE",
  size = 48,
  label,
  className = "",
}: {
  state?: PulseAvatarState;
  size?: keyof typeof SIZES | number;
  label?: string;
  className?: string;
}) {
  const px = typeof size === "number" ? size : SIZES[size];
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    function onVis() {
      setHidden(document.hidden);
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const announced = label || PULSE_AVATAR_LABELS[state];

  return (
    <span
      className={`pulse-glyph ${hidden ? "is-paused" : ""} ${className}`}
      data-state={state}
      data-size={px}
      style={{ width: px, height: px }}
      role="img"
      aria-label={announced}
    >
      <svg viewBox="0 0 64 64" width={px} height={px} aria-hidden="true">
        <defs>
          <linearGradient id="pulse-aurora" x1="18" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#7fb2e0" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#ff7a45" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ff5a1f" stopOpacity="0.7" />
          </linearGradient>
          <filter id="pulse-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>
        <rect className="pulse-core" x="10" y="10" width="44" height="44" rx="12" />
        <path className="pulse-ring" d="M18 14.5h28a9.5 9.5 0 0 1 9.5 9.5v10" />
        <path className="pulse-filament" d="M22 40c4-10 8-16 14-16s8 9 12 4" />
        <path className="pulse-filament-two" d="M20 28c6 2 10 8 16 7 6-1 8-8 12-6" />
        <rect className="pulse-notch" x="29" y="13" width="6" height="3" rx="1.2" />
        <path className="pulse-scan" d="M16 32h32" />
      </svg>
    </span>
  );
}
