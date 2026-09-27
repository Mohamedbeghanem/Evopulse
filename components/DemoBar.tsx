"use client";

import { Icon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const ITEMS: { id: string; label: string; busy: string; path: string; next: string }[] = [
  { id: "reset", label: "Reset demo", busy: "Resetting…", path: "/api/demo/reset", next: "/" },
  { id: "supplier", label: "Trigger supplier delay", busy: "Cascading…", path: "/api/demo/supplier-delay", next: "/explore" },
  { id: "earlier", label: "Earlier arrival", busy: "Revising…", path: "/api/demo/shipment-earlier", next: "/warnings" },
  {
    id: "discount",
    label: "Customer requests 10%",
    busy: "Ingesting…",
    path: "/api/demo/discount",
    next: "/exceptions/exc_discount_blocked",
  },
  { id: "safe", label: "Handle safe actions", busy: "Handling…", path: "/api/autopilot/handle-safe", next: "/" },
];

export function DemoBar() {
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }

    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  async function post(path: string, id: string, next: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setOpen(false);
      router.refresh();
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-btn border border-line bg-card px-2.5 text-[12px] text-ink hover:bg-cream"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-busy={Boolean(busy)}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="demo" size={16} />
        Demo
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="DEMO"
          className="motion-pop absolute right-0 z-50 mt-2 w-64 rounded-card border border-line bg-card p-2 text-ink shadow-sm"
        >
          <p className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">DEMO</p>
          {ITEMS.map((item, index) => (
            <button
              key={item.id}
              ref={index === 0 ? firstItemRef : undefined}
              type="button"
              role="menuitem"
              disabled={Boolean(busy)}
              className="flex w-full rounded-md px-2 py-2 text-left text-[13px] text-ink hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => post(item.path, item.id, item.next)}
            >
              {busy === item.id ? item.busy : item.label}
            </button>
          ))}
          {error ? (
            <p className="px-2 py-1 text-[12px] text-bad" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      {!open && error ? (
        <p className="absolute right-0 top-full z-50 mt-1 max-w-xs rounded-btn border border-line bg-card px-2 py-1 text-[12px] text-bad" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
