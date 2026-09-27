"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DemoBar } from "./DemoBar";
import { Sidebar } from "./shell/Sidebar";

export function AppShell({ children, workspaceMode = "entry" }: { children: React.ReactNode; workspaceMode?: "entry" | "running" }) {
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
        <button type="button" className="fixed inset-0 z-30 bg-ink-950/70 lg:hidden" aria-label="Close menu" onClick={() => setNavOpen(false)} />
      ) : null}
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
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
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">Sunday 27 Sep 2026 · Africa/Tunis</p>
          <p className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-ok sm:block">LIVE</p>
        </header>
        {workspaceMode === "running" ? <DemoBar /> : null}
        <div id="workspace" className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
        <p className="sr-only">
          Contextual tools stay off the primary rail:{" "}
          <Link href="/explore">Explore</Link>, <Link href="/simulate">Simulate</Link>,{" "}
          <Link href="/warnings">Warnings</Link>, <Link href="/autopilot">Autopilot</Link>.
        </p>
      </div>
    </div>
  );
}
