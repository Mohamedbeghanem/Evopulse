"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY = [
  { href: "/", label: "Pulse" },
  { href: "/command", label: "Command" },
  { href: "/timeline", label: "Timeline" },
  { href: "/business", label: "Business" },
  { href: "/goals", label: "Goals" },
];

const CONTROL = [
  { href: "/policy", label: "Policies / Control" },
  { href: "/learning", label: "Learning" },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-ink-950/70 lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-white/10 bg-ink-950 px-5 py-7 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href="/" className="block" onClick={onClose}>
          <span className="font-serif text-[26px] leading-none tracking-tight">EvoPulse</span>
          <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
            Control OS
          </span>
        </Link>
        <nav className="mt-10 flex flex-col gap-0.5" aria-label="Primary">
          {PRIMARY.map((item) => {
            const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center border-l-2 px-2.5 font-mono text-[11px] uppercase tracking-[0.16em] ${
                  active ? "border-need text-paper" : "border-transparent text-sand hover:text-paper"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <nav className="mt-8 flex flex-col gap-0.5" aria-label="Control">
          {CONTROL.map((item) => {
            const active = path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex min-h-9 items-center px-2.5 font-mono text-[11px] uppercase tracking-[0.14em] ${
                  active ? "text-paper" : "text-mute hover:text-sand"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto font-mono text-[10px] leading-relaxed tracking-wide text-mute">
          AI reasons.
          <br />
          Software enforces.
          <br />
          Humans govern.
        </p>
      </aside>
    </>
  );
}
