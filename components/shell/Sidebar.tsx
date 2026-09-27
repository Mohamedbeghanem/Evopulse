"use client";

import { Icon, type IconName } from "@/components/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  hint?: string;
  match: (path: string) => boolean;
};

const PRIMARY: NavItem[] = [
  { href: "/", label: "Pulse", icon: "pulse", match: (path) => path === "/" || path.startsWith("/situations") },
  { href: "/command", label: "Command", icon: "command", hint: "⌘K", match: (path) => path.startsWith("/command") },
  { href: "/timeline", label: "Timeline", icon: "timeline", match: (path) => path.startsWith("/timeline") },
  { href: "/business", label: "Business", icon: "business", match: (path) => path.startsWith("/business") },
  { href: "/goals", label: "Goals", icon: "goals", match: (path) => path.startsWith("/goals") },
];

const BOTTOM: NavItem[] = [
  { href: "/control", label: "Control", icon: "control", match: (path) => path.startsWith("/control") },
  { href: "/settings", label: "Settings", icon: "settings", match: (path) => path.startsWith("/settings") },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[232px] shrink-0 flex-col bg-side text-side-text transition-transform min-[900px]:static min-[900px]:min-h-screen min-[900px]:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
      aria-label="EvoPulse"
    >
      <div className="flex items-start justify-between px-3 pb-3 pt-[18px]">
        <Link href="/" className="flex items-center gap-2.5 px-2.5" onClick={onClose}>
          <svg className="h-[22px] w-[22px] shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 16L12 4l8 12-8 4-8-4z" fill="#EC6025" />
            <path d="M12 8v12" stroke="#F7F8F5" strokeWidth="1.4" />
          </svg>
          <span>
            <span className="block text-[15px] font-semibold tracking-[0.02em] text-[#E8EEF0]">EvoPulse</span>
            <span className="block text-[11px] font-normal text-side-muted">Nothing falls through.</span>
          </span>
        </Link>
        <button type="button" className="px-2 text-[11px] uppercase text-side-muted min-[900px]:hidden" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="px-3 pb-2">
        <Link
          href="/command"
          onClick={onClose}
          className="motion-safe flex min-h-9 items-center gap-2.5 px-2.5 text-[13px] font-medium text-[#E8EEF0] hover:bg-side-hover"
        >
          <Icon name="plus" className="h-[18px] w-[18px] shrink-0" />
          New command
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3" aria-label="Primary">
        <p className="px-2.5 pb-1.5 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-side-label">Primary</p>
        <NavList items={PRIMARY} path={path} onNavigate={onClose} />
      </nav>

      <nav className="mt-auto border-t border-side-line px-3 py-3" aria-label="Control and settings">
        <NavList items={BOTTOM} path={path} onNavigate={onClose} />
      </nav>
    </aside>
  );
}

function NavList({ items, path, onNavigate }: { items: NavItem[]; path: string; onNavigate: () => void }) {
  return (
    <div className="flex flex-col">
      {items.map((item) => {
        const active = item.match(path);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={`motion-safe relative flex min-h-9 items-center gap-2.5 px-2.5 text-[13px] ${
              active ? "bg-side-active text-[#F7F8F5]" : "text-side-text hover:bg-side-hover hover:text-[#F7F8F5]"
            }`}
          >
            {active ? (
              <span className="motion-safe absolute bottom-2 left-0 top-2 w-0.5 bg-[#E8EEF0]" aria-hidden />
            ) : null}
            <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
            {item.label}
            {item.hint ? <span className="ml-auto font-mono text-[10px] text-side-muted">{item.hint}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}
