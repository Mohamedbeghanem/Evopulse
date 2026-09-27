"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PulseAvatar } from "@/components/pulse-avatar/PulseAvatar";
import type { PublicUser, PublicWorkspace } from "@/lib/auth/types";

const PRIMARY = [
  { href: "/pulse", label: "Pulse", match: (path: string) => path === "/pulse" || path.startsWith("/situations") },
  { href: "/command", label: "Command", match: (path: string) => path.startsWith("/command") },
  { href: "/timeline", label: "Timeline", match: (path: string) => path.startsWith("/timeline") },
];

const WORKSPACE = [
  { href: "/business", label: "Business", match: (path: string) => path.startsWith("/business") || path.startsWith("/graph") },
  { href: "/goals", label: "Goals", match: (path: string) => path.startsWith("/goals") },
  { href: "/approvals", label: "Approvals", match: (path: string) => path.startsWith("/approvals") },
  { href: "/connectors", label: "Connectors", match: (path: string) => path.startsWith("/connectors") },
];

const MORE = [
  { href: "/notifications", label: "Notifications" },
  { href: "/settings/workspace", label: "Workspace" },
  { href: "/settings/integrations", label: "Integrations" },
  { href: "/connectors", label: "Connectors & Plugins" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/policies", label: "Policies" },
  { href: "/settings/profile", label: "Profile" },
  { href: "/demo", label: "Explore demo workspace" },
];

export function UserAppShell({
  children,
  user,
  workspace,
}: {
  children: ReactNode;
  user: PublicUser;
  workspace: PublicWorkspace;
}) {
  const path = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [path]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/command");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="os-frame flex min-h-screen">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      {navOpen ? (
        <button type="button" className="fixed inset-0 z-30 bg-ink-950/70 lg:hidden" aria-label="Close menu" onClick={() => setNavOpen(false)} />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-hairline bg-ink-900 transition-transform lg:static lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="EvoPulse"
      >
        <div className="flex h-14 items-center gap-2 px-4">
          <PulseAvatar size={24} state="IDLE" />
          <Link href="/pulse" className="text-sm font-medium" onClick={() => setNavOpen(false)}>
            EvoPulse
          </Link>
        </div>
        <div className="px-3">
          <button
            type="button"
            className="flex min-h-[34px] w-full items-center justify-between rounded-md bg-ink-600 px-3 text-sm"
            onClick={() => {
              setNavOpen(false);
              router.push("/command");
            }}
          >
            Ask Pulse
            <kbd className="font-mono text-[10px] text-mute">⌘K</kbd>
          </button>
        </div>
        <nav className="mt-6 space-y-5 px-3">
          <NavBlock title="Primary" items={PRIMARY} path={path} onNavigate={() => setNavOpen(false)} />
          <NavBlock title="Workspace" items={WORKSPACE} path={path} onNavigate={() => setNavOpen(false)} />
        </nav>
        <div className="mt-auto space-y-1 border-t border-hairline px-3 py-4">
          {MORE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setNavOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-sand hover:text-paper"
            >
              {item.label}
            </Link>
          ))}
          <p className="px-3 pt-3 text-sm text-paper">
            {user.name}
            <span className="block text-xs text-mute">{workspace.name}</span>
          </p>
          <button type="button" onClick={() => void logout()} className="px-3 pt-2 text-sm text-sand hover:text-paper">
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center justify-between border-b border-hairline px-4 lg:px-8">
          <button
            type="button"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-sand lg:hidden"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((value) => !value)}
          >
            Menu
          </button>
          <p className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{workspace.name}</p>
          <Link href="/command" className="flex items-center gap-2" aria-label="Open command">
            <PulseAvatar size={24} state="IDLE" />
          </Link>
        </header>
        <div id="workspace" className="flex min-h-0 flex-1 flex-col pb-16 lg:pb-0">
          {children}
        </div>
        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-hairline bg-ink-900 lg:hidden"
          aria-label="Mobile"
        >
          {[...PRIMARY, { href: "/business", label: "Business" }, { href: "/notifications", label: "Alerts" }].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-14 items-center justify-center text-[11px] ${
                path === item.href || path.startsWith(item.href + "/") ? "text-need" : "text-sand"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
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
