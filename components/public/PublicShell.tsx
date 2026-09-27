"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const LINKS = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/security", label: "Security" },
];

export function PublicShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-need" aria-hidden />
            <span className="text-sm font-medium tracking-tight">EvoPulse</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-sand md:flex" aria-label="Public">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={path === link.href ? "page" : undefined}
                className={path === link.href ? "text-paper" : "hover:text-paper"}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-md px-3 py-2 text-sm text-sand hover:text-paper">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-md bg-need px-3 py-2 text-sm font-medium text-ink-950">
              Start with EvoPulse
            </Link>
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-mute">
          <p>EvoPulse · Nothing falls through.</p>
          <div className="flex gap-4">
            <Link href="/security" className="hover:text-paper">
              Control
            </Link>
            <Link href="/demo" className="hover:text-paper">
              Explore demo workspace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
