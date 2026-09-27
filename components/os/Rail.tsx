"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { isActive, type NavItem } from "@/lib/ui/nav";
import { Icon, type IconName } from "./icons";

export type RailItem = NavItem & { icon: IconName; short: string };

const ITEM =
  "flex flex-1 flex-col items-center justify-center gap-1 rounded-panel font-mono text-os-rail uppercase no-underline transition-colors md:h-[52px] md:w-[52px] md:flex-none";
const ITEM_ON = "bg-os-raise-2 text-risk-fg";
const ITEM_OFF = "text-fg-5 hover:bg-os-raise hover:text-fg";

/**
 * Primary navigation. A 64px left rail from `md` up; a bottom tab bar below that.
 * Four design screens + a "More" menu for everything else.
 */
export function Rail({ items, more }: { items: RailItem[]; more: NavItem[] }) {
  const path = usePathname() || "/";
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch gap-1 border-t border-os-line bg-os-rail px-1 py-1 md:sticky md:top-0 md:h-screen md:w-16 md:shrink-0 md:flex-col md:items-center md:gap-1.5 md:border-r md:border-t-0 md:px-0 md:py-3"
    >
      <Link
        href="/"
        aria-label="EvoPulse home"
        className="mb-3.5 hidden h-9 w-9 items-center justify-center rounded-node bg-risk text-[#0A0C0F] md:flex"
      >
        <Icon name="pulse" size={22} className="[stroke-width:2.4]" />
      </Link>
      {items.map((item) => {
        const on = isActive(path, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={on ? "page" : undefined}
            className={`${ITEM} ${on ? ITEM_ON : ITEM_OFF}`}
          >
            <Icon name={item.icon} />
            {item.short}
          </Link>
        );
      })}
      <div className="hidden md:block md:flex-1" />
      <MoreMenu items={more} path={path} />
    </nav>
  );
}

function MoreMenu({ items, path }: { items: NavItem[]; path: string }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const current = items.find((item) => isActive(path, item));

  // Close when the route changes.
  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative flex flex-1 md:flex-none">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={current ? `More: ${current.label}` : "More"}
        onClick={() => setOpen((value) => !value)}
        className={`${ITEM} ${current || open ? ITEM_ON : ITEM_OFF}`}
      >
        <Icon name="more" />
        More
      </button>
      {open ? (
        <ul
          id={menuId}
          className="absolute bottom-full right-0 mb-2 w-48 rounded-panel border border-os-line-2 bg-os-panel p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)] md:bottom-0 md:left-full md:right-auto md:mb-0 md:ml-2"
        >
          {items.map((item) => {
            const on = isActive(path, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex h-9 items-center rounded-ctl px-3 text-[13px] no-underline ${
                    on ? "bg-os-raise-2 text-risk-fg" : "text-fg-2 hover:bg-os-raise hover:text-fg"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
