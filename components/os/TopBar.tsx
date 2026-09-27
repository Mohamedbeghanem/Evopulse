"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { screenTitle } from "@/lib/ui/nav";
import { AskBar } from "./AskBar";

/**
 * 56px top bar: brand + breadcrumb, ask box, and the demo clock.
 * The clock is the seeded demo time (meta.demo_now), not wall time, so it is labelled DEMO.
 */
export function TopBar({ demoStamp, askPlaceholder }: { demoStamp: string; askPlaceholder: string }) {
  const path = usePathname() || "/";
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-os-line bg-os-rail px-4 md:gap-4 md:px-6">
      <div className="flex min-w-0 shrink-0 items-baseline gap-2.5">
        <Link href="/" className="text-base font-bold tracking-[-0.01em] text-fg no-underline">
          EvoPulse
        </Link>
        <span className="hidden truncate font-mono text-xs text-fg-5 sm:inline">
          / <span className="text-fg-2">{screenTitle(path)}</span>
        </span>
      </div>
      <div className="hidden flex-1 md:block" />
      <AskBar placeholder={askPlaceholder} />
      <div
        className="flex h-7 shrink-0 items-center gap-2 rounded-full border border-os-line-2 px-2.5"
        title={demoStamp ? `Demo clock: ${demoStamp}` : "Demo data"}
      >
        <span className="h-2 w-2 rounded-full bg-risk" aria-hidden="true" />
        <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-fg">DEMO</span>
      </div>
      {demoStamp ? (
        <span className="hidden shrink-0 font-mono text-xs text-fg-3 lg:inline">
          <span className="sr-only">Demo time </span>
          {demoStamp}
        </span>
      ) : null}
    </header>
  );
}
