"use client";

import {
  Activity,
  Bell,
  Blocks,
  Building2,
  Cable,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  Compass,
  History,
  LayoutGrid,
  LogOut,
  Plug,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PulseAvatar } from "@/components/pulse-avatar/PulseAvatar";
import { NAV_ICON, useNavCollapsed } from "@/components/shell/useNavCollapsed";
import type { PublicUser, PublicWorkspace } from "@/lib/auth/types";

type NavItem = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

const PRIMARY: NavItem[] = [
  { href: "/pulse", label: "Pulse", icon: Activity, match: (path: string) => path === "/pulse" || path.startsWith("/situations") },
  { href: "/command", label: "Command", icon: Terminal, match: (path: string) => path.startsWith("/command") },
  { href: "/timeline", label: "Timeline", icon: History, match: (path: string) => path.startsWith("/timeline") },
];

const WORKSPACE: NavItem[] = [
  { href: "/business", label: "Business", icon: Building2, match: (path: string) => path.startsWith("/business") || path.startsWith("/graph") },
  { href: "/goals", label: "Goals", icon: Target, match: (path: string) => path.startsWith("/goals") },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck, match: (path: string) => path.startsWith("/approvals") },
  { href: "/connectors", label: "Connectors", icon: Plug, match: (path: string) => path.startsWith("/connectors") },
];

const MORE: NavItem[] = [
  { href: "/notifications", label: "Notifications", icon: Bell, match: (path: string) => path.startsWith("/notifications") },
  { href: "/settings/workspace", label: "Workspace", icon: LayoutGrid, match: (path: string) => path === "/settings/workspace" },
  { href: "/settings/integrations", label: "Integrations", icon: Cable, match: (path: string) => path === "/settings/integrations" },
  { href: "/connectors", label: "Connectors & Plugins", icon: Blocks, match: () => false },
  { href: "/settings/team", label: "Team", icon: Users, match: (path: string) => path === "/settings/team" },
  { href: "/settings/policies", label: "Policies", icon: ShieldCheck, match: (path: string) => path === "/settings/policies" },
  { href: "/settings/profile", label: "Profile", icon: User, match: (path: string) => path === "/settings/profile" },
  { href: "/demo", label: "Explore demo workspace", icon: Compass, match: () => false },
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
  const { collapsed, toggle } = useNavCollapsed();

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
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col overflow-y-auto border-r border-hairline bg-ink-900 transition-[transform,width] lg:static lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-16" : ""}`}
        aria-label="EvoPulse"
        data-collapsed={collapsed ? "true" : "false"}
      >
        <div className={`flex h-14 items-center gap-2 px-4 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          <PulseAvatar size={24} state="IDLE" />
          <Link href="/pulse" className={`text-sm font-medium ${collapsed ? "lg:sr-only" : ""}`} onClick={() => setNavOpen(false)}>
            EvoPulse
          </Link>
        </div>
        <div className="px-3">
          <button
            type="button"
            aria-label="Ask Pulse"
            title={collapsed ? "Ask Pulse (⌘K)" : undefined}
            className={`flex min-h-[34px] w-full items-center justify-between rounded-md bg-ink-600 px-3 text-sm ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
            onClick={() => {
              setNavOpen(false);
              router.push("/command");
            }}
          >
            <span className="flex items-center gap-2.5">
              <Sparkles {...NAV_ICON} />
              <span className={collapsed ? "lg:sr-only" : ""}>Ask Pulse</span>
            </span>
            <kbd className={`font-mono text-[10px] text-mute ${collapsed ? "lg:hidden" : ""}`}>⌘K</kbd>
          </button>
        </div>
        <nav className="mt-6 space-y-5 px-3" aria-label="Primary">
          <NavBlock title="Primary" items={PRIMARY} path={path} collapsed={collapsed} onNavigate={() => setNavOpen(false)} />
          <NavBlock title="Workspace" items={WORKSPACE} path={path} collapsed={collapsed} onNavigate={() => setNavOpen(false)} />
        </nav>
        <nav className="mt-auto space-y-0.5 border-t border-hairline px-3 py-4" aria-label="More">
          {MORE.map((item) => (
            <NavLink key={item.href + item.label} item={item} active={item.match(path)} collapsed={collapsed} onNavigate={() => setNavOpen(false)} quiet />
          ))}
          <p className={`px-3 pt-3 text-sm text-paper ${collapsed ? "lg:hidden" : ""}`}>
            {user.name}
            <span className="block text-xs text-mute">{workspace.name}</span>
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Sign out"
            title={collapsed ? "Sign out" : undefined}
            className={`flex min-h-[34px] w-full items-center gap-2.5 rounded-md px-3 text-sm text-sand hover:text-paper ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
          >
            <LogOut {...NAV_ICON} />
            <span className={collapsed ? "lg:sr-only" : ""}>Sign out</span>
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`hidden min-h-[34px] w-full items-center gap-2.5 rounded-md px-3 text-sm text-mute hover:text-paper lg:flex ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
          >
            {collapsed ? <ChevronsRight {...NAV_ICON} /> : <ChevronsLeft {...NAV_ICON} />}
            <span className={collapsed ? "lg:sr-only" : ""}>Collapse</span>
          </button>
        </nav>
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
          {[...PRIMARY, { href: "/business", label: "Business", icon: Building2 }, { href: "/notifications", label: "Alerts", icon: Bell }].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${
                path === item.href || path.startsWith(item.href + "/") ? "text-need" : "text-sand"
              }`}
            >
              <item.icon {...NAV_ICON} />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
  quiet = false,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
  quiet?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={`flex min-h-[34px] items-center gap-2.5 rounded-md px-3 text-sm ${collapsed ? "lg:justify-center lg:px-0" : ""} ${
        active ? "nav-active text-paper" : quiet ? "text-sand hover:text-paper" : "text-sand hover:bg-ink-800 hover:text-paper"
      }`}
    >
      <Icon {...NAV_ICON} className={`${NAV_ICON.className} ${active ? "text-need" : ""}`} />
      <span className={`truncate ${collapsed ? "lg:sr-only" : ""}`}>{item.label}</span>
    </Link>
  );
}

function NavBlock({
  title,
  items,
  path,
  collapsed,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  path: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <div>
      <p className={`px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-mute ${collapsed ? "lg:sr-only" : ""}`}>{title}</p>
      <div className="mt-1 space-y-0.5">
        {items.map((item) => (
          <NavLink key={item.href} item={item} active={item.match(path)} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

/** Exported for tests: every nav item has an icon and a visible label. */
export const USER_NAV_SECTIONS = { primary: PRIMARY, workspace: WORKSPACE, more: MORE };
