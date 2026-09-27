"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DemoBar } from "./DemoBar";
import { Sidebar } from "./shell/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [path]);

  return (
    <div className="flex min-h-screen">
      <a href="#workspace" className="skip-link">
        Skip to workspace
      </a>
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center justify-between border-b border-white/10 px-4 lg:px-8">
          <button
            type="button"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-sand lg:hidden"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((value) => !value)}
          >
            Menu
          </button>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">
            Sunday 27 Sep 2026 · Africa/Tunis
          </p>
          <p className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-mute sm:block">LIVE</p>
        </header>
        <DemoBar />
        <div id="workspace" className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
