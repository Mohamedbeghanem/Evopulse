"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DemoBar } from "./DemoBar";

const NAV = [
  { href: "/", label: "Pulse" },
  { href: "/explore", label: "Explore" },
  { href: "/timeline", label: "Timeline" },
  { href: "/simulate", label: "Simulate" },
  { href: "/command", label: "Command" },
  { href: "/goals", label: "Goals" },
  { href: "/graph", label: "Graph" },
  { href: "/warnings", label: "Warnings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-baseline gap-3">
            <span className="font-serif text-2xl tracking-tight">EvoPulse</span>
            <span className="hidden text-[11px] uppercase tracking-[0.22em] text-mute sm:inline">
              Business Control System
            </span>
          </Link>
          <nav className="flex gap-1 text-sm">
            {NAV.map((item) => {
              const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1.5 ${
                    active ? "bg-paper text-ink-950" : "text-sand hover:text-paper"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <DemoBar />
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
