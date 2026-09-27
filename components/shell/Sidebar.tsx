"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const PRIMARY = [
  { href: "/", label: "Pulse", match: (path: string) => path === "/demo" || path === "/" || path.startsWith("/situations") },
  { href: "/command", label: "Command", match: (path: string) => path.startsWith("/command") },
  { href: "/timeline", label: "Timeline", match: (path: string) => path.startsWith("/timeline") },
];

const WORKSPACE = [
  { href: "/business", label: "Business", match: (path: string) => path.startsWith("/business") || path.startsWith("/graph") },
  { href: "/agents", label: "Agents", match: (path: string) => path.startsWith("/agents") },
  { href: "/goals", label: "Goals", match: (path: string) => path.startsWith("/goals") },
  { href: "/connectors", label: "Connectors", match: (path: string) => path.startsWith("/connectors") },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const router = useRouter();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-hairline bg-ink-900 transition-transform lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
      aria-label="Control OS"
    >
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" onClick={onClose}>
          <span className="h-2 w-2 rounded-full bg-need" aria-hidden />
          <span className="text-sm font-medium tracking-tight text-paper">EvoPulse</span>
        </Link>
        <button type="button" className="font-mono text-[11px] uppercase text-mute lg:hidden" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="space-y-2 px-3">
        <button
          type="button"
          className="flex min-h-[34px] w-full items-center justify-between rounded-md bg-ink-600 px-3 text-sm text-paper"
          onClick={async () => {
            onClose();
            await fetch("/api/company/new", { method: "POST" });
            window.location.assign("/");
          }}
        >
          + New company
          <span className="font-mono text-[10px] text-mute">+</span>
        </button>
        <button
          type="button"
          className="flex min-h-[34px] w-full items-center justify-between rounded-md border border-hairline px-3 text-sm text-sand hover:text-paper"
          onClick={() => {
            onClose();
            router.push("/command");
          }}
        >
          New command
          <span className="font-mono text-[10px] text-mute">+</span>
        </button>
        <button
          type="button"
          className="flex min-h-[34px] w-full items-center justify-between rounded-md border border-hairline px-3 text-sm text-sand hover:text-paper"
          onClick={() => {
            onClose();
            router.push("/command");
          }}
        >
          Ask your business
          <kbd className="font-mono text-[10px] text-mute">⌘K</kbd>
        </button>
      </div>

      <nav className="mt-6 space-y-5 px-3" aria-label="Primary">
        <NavBlock title="Primary" items={PRIMARY} path={path} onNavigate={onClose} />
        <NavBlock title="Workspace" items={WORKSPACE} path={path} onNavigate={onClose} />
      </nav>

      <div className="mt-auto space-y-1 border-t border-hairline px-3 py-4">
        <Link href="/policy" className="block rounded-md px-3 py-2 text-sm text-sand hover:text-paper" onClick={onClose}>
          Policies / Control
        </Link>
        <Link href="/autonomy" className="block rounded-md px-3 py-2 text-sm text-sand hover:text-paper" onClick={onClose}>
          Settings
        </Link>
        <p className="px-3 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ok">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
          LIVE
        </p>
        <p className="px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-mute">Sun 27 Sep · 08:18 CET</p>
        <p className="px-3 pt-2 text-sm text-paper">
          Mohamed <span className="block text-xs text-mute">Operator</span>
        </p>
        <p className="px-3 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Nothing falls through.</p>
      </div>
    </aside>
  );
}

function NavBlock({
  title,
  items,
  path,
  onNavigate,
}: {
  title: string;
  items: { href: string; label: string; match: (path: string) => boolean }[];
  path: string;
  onNavigate: () => void;
}) {
  return (
    <div>
      <p className="px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-mute">{title}</p>
      <div className="mt-1 space-y-0.5">
        {items.map((item) => {
          const active = item.match(path);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`flex min-h-[34px] items-center rounded-md px-3 text-sm ${
                active ? "nav-active text-paper" : "text-sand hover:bg-ink-800 hover:text-paper"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
