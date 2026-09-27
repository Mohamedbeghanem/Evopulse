"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/m", label: "Needs me" },
  { href: "/m#done", label: "Handled" },
  { href: "/m/ask", label: "Ask" },
];

export function MobileNav() {
  const path = usePathname() || "/m";
  return (
    <nav
      aria-label="Mobile"
      className="sticky bottom-0 z-40 flex w-full border-t border-hairline bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      {TABS.map((tab) => {
        const active = tab.href === "/m/ask" ? path.startsWith("/m/ask") : tab.href === "/m" && path === "/m";
        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[56px] flex-1 items-center justify-center text-sm ${active ? "text-need" : "text-sand"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
