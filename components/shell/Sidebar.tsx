"use client";

import {
  Activity,
  Bot,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  History,
  Plug,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Target,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ICON, useNavCollapsed } from "./useNavCollapsed";

type NavItem = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

const PRIMARY: NavItem[] = [
  { href: "/", label: "Pulse", icon: Activity, match: (path: string) => path === "/demo" || path === "/" || path.startsWith("/situations") },
  { href: "/command", label: "Command", icon: Terminal, match: (path: string) => path.startsWith("/command") },
  { href: "/timeline", label: "Timeline", icon: History, match: (path: string) => path.startsWith("/timeline") },
];

const WORKSPACE: NavItem[] = [
  { href: "/business", label: "Business", icon: Building2, match: (path: string) => path.startsWith("/business") || path.startsWith("/graph") },
  { href: "/agents", label: "Agents", icon: Bot, match: (path: string) => path.startsWith("/agents") },
  { href: "/goals", label: "Goals", icon: Target, match: (path: string) => path.startsWith("/goals") },
  { href: "/connectors", label: "Connectors", icon: Plug, match: (path: string) => path.startsWith("/connectors") },
];

const FOOTER: NavItem[] = [
  { href: "/policy", label: "Policies / Control", icon: ShieldCheck, match: (path: string) => path.startsWith("/policy") },
  { href: "/autonomy", label: "Settings", icon: Settings, match: (path: string) => path.startsWith("/autonomy") },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const { collapsed, toggle } = useNavCollapsed();
  const hide = collapsed ? "lg:sr-only" : "";
  const center = collapsed ? "lg:justify-center lg:px-0" : "";

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col overflow-y-auto border-r border-hairline bg-ink-900 transition-[transform,width] lg:static lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      } ${collapsed ? "lg:w-16" : ""}`}
      aria-label="Control OS"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className={`flex h-14 items-center justify-between px-4 ${center}`}>
        <Link href="/" className="flex items-center gap-2" onClick={onClose} aria-label="EvoPulse home">
          <span className="h-2 w-2 rounded-full bg-need" aria-hidden />
          <span className={`text-sm font-medium tracking-tight text-paper ${hide}`}>EvoPulse</span>
        </Link>
        <button type="button" className="font-mono text-[11px] uppercase text-mute lg:hidden" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="space-y-2 px-3">
        <button
          type="button"
          aria-label="New company"
          title={collapsed ? "New company" : undefined}
          className={`flex min-h-[34px] w-full items-center justify-between rounded-md bg-ink-600 px-3 text-sm text-paper ${center}`}
          onClick={async () => {
            onClose();
            await fetch("/api/company/new", { method: "POST" });
            window.location.assign("/");
          }}
        >
          <span className="flex items-center gap-2.5">
            <Plus {...NAV_ICON} />
            <span className={hide}>New company</span>
          </span>
          <span className={`font-mono text-[10px] text-mute ${collapsed ? "lg:hidden" : ""}`}>+</span>
        </button>
        <button
          type="button"
          aria-label="New command"
          title={collapsed ? "New command" : undefined}
          className={`flex min-h-[34px] w-full items-center justify-between rounded-md border border-hairline px-3 text-sm text-sand hover:text-paper ${center}`}
          onClick={() => {
            onClose();
            router.push("/command");
          }}
        >
          <span className="flex items-center gap-2.5">
            <SquarePen {...NAV_ICON} />
            <span className={hide}>New command</span>
          </span>
          <span className={`font-mono text-[10px] text-mute ${collapsed ? "lg:hidden" : ""}`}>+</span>
        </button>
        <button
          type="button"
          aria-label="Ask your business"
          title={collapsed ? "Ask your business (⌘K)" : undefined}
          className={`flex min-h-[34px] w-full items-center justify-between rounded-md border border-hairline px-3 text-sm text-sand hover:text-paper ${center}`}
          onClick={() => {
            onClose();
            router.push("/command");
          }}
        >
          <span className="flex items-center gap-2.5">
            <Sparkles {...NAV_ICON} />
            <span className={hide}>Ask your business</span>
          </span>
          <kbd className={`font-mono text-[10px] text-mute ${collapsed ? "lg:hidden" : ""}`}>⌘K</kbd>
        </button>
      </div>

      <nav className="mt-6 space-y-5 px-3" aria-label="Primary">
        <NavBlock title="Primary" items={PRIMARY} path={path} collapsed={collapsed} onNavigate={onClose} />
        <NavBlock title="Workspace" items={WORKSPACE} path={path} collapsed={collapsed} onNavigate={onClose} />
      </nav>

      <div className="mt-auto space-y-1 border-t border-hairline px-3 py-4">
        {FOOTER.map((item) => (
          <NavLink key={item.href} item={item} active={item.match(path)} collapsed={collapsed} onNavigate={onClose} quiet />
        ))}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`hidden min-h-[34px] w-full items-center gap-2.5 rounded-md px-3 text-sm text-mute hover:text-paper lg:flex ${center}`}
        >
          {collapsed ? <ChevronsRight {...NAV_ICON} /> : <ChevronsLeft {...NAV_ICON} />}
          <span className={hide}>Collapse</span>
        </button>
        <div className={collapsed ? "lg:hidden" : ""}>
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
      </div>
    </aside>
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
export const CONTROL_NAV_SECTIONS = { primary: PRIMARY, workspace: WORKSPACE, footer: FOOTER };
