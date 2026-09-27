"use client";

import { Icon } from "@/components/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DemoBar } from "./DemoBar";
import { Sidebar } from "./shell/Sidebar";

const CRUMBS: [string, string][] = [
  ["/warnings", "Warnings"],
  ["/autopilot", "Autopilot"],
  ["/explore", "Explore"],
  ["/graph", "Graph"],
  ["/impact", "Impact"],
  ["/timeline", "Timeline"],
  ["/business", "Business"],
  ["/simulate", "Simulate"],
  ["/command", "Command"],
  ["/goals", "Goals"],
  ["/control", "Control"],
  ["/settings", "Settings"],
  ["/policy", "Policy"],
  ["/autonomy", "Autonomy"],
  ["/learning", "Learning"],
  ["/situations", "Situation"],
  ["/exceptions", "Exception"],
  ["/evidence", "Evidence"],
  ["/verification", "Verification"],
];

function crumbLabel(path: string) {
  if (path === "/") return "Pulse";
  const hit = CRUMBS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return hit ? hit[1] : "EvoPulse";
}

export function AppShell({ children }: { children: React.ReactNode }) {
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

  return (
    <div className="os-frame flex min-h-screen">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      {navOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/50 min-[900px]:hidden"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-card px-4 min-[900px]:px-6">
          <button
            type="button"
            className="shrink-0 text-[12px] font-medium text-ink min-[900px]:hidden"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((value) => !value)}
          >
            Menu
          </button>
          <p className="min-w-0 flex-1 truncate text-[13px] text-muted">
            Atlas Retail Group
            <span aria-hidden> / </span>
            <strong className="font-semibold text-ink">{crumbLabel(path)}</strong>
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/command"
              aria-label="Search"
              className="inline-flex h-8 w-8 items-center justify-center rounded-btn text-ink hover:bg-cream"
            >
              <Icon name="search" className="h-[18px] w-[18px]" />
            </Link>
            <DemoBar />
            <p className="text-[12px] text-muted">Pulse · Ready</p>
          </div>
        </header>
        <div id="workspace" className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
