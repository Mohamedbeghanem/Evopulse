"use client";

import { useEffect, useState } from "react";
import { avatarStateFromAgent, type PulseAvatarState } from "@/lib/company";

export function useAgentAvatar(initial: PulseAvatarState = "IDLE") {
  const [state, setState] = useState<PulseAvatarState>(initial);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/agent/status", { cache: "no-store" });
        const data = (await res.json()) as { state?: PulseAvatarState; phase?: string; status?: string };
        if (cancelled) return;
        setState(data.state || avatarStateFromAgent(data.phase, data.status));
      } catch {
        if (!cancelled) setState("IDLE");
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return state;
}
