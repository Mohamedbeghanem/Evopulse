"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PulseAvatar } from "@/components/pulse-avatar/PulseAvatar";

const STEPS = [
  { href: "/onboarding", id: "welcome" },
  { href: "/onboarding/business", id: "business" },
  { href: "/onboarding/protect", id: "protect" },
  { href: "/onboarding/meet", id: "meet" },
  { href: "/onboarding/connect", id: "connect" },
  { href: "/onboarding/discovery", id: "discovery" },
  { href: "/onboarding/review", id: "review" },
  { href: "/onboarding/goal", id: "goal" },
  { href: "/onboarding/first-pulse", id: "first-pulse" },
];

export function OnboardingShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const index = Math.max(
    0,
    STEPS.findIndex((step) => step.href === path),
  );
  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm">
            <PulseAvatar size={24} state="IDLE" />
            <span>EvoPulse</span>
          </Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
            {index + 1} / {STEPS.length}
          </p>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 px-5 pb-3" aria-hidden>
          {STEPS.map((step, i) => (
            <span key={step.id} className={`h-0.5 flex-1 ${i <= index ? "bg-need" : "bg-hairline"}`} />
          ))}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 py-10">
        {children}
      </main>
    </div>
  );
}
