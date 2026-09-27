"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DemoBar() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, label: string, next?: string) {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      router.refresh();
      if (next) router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border-b border-hairline bg-ink-800/80">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-xs lg:px-8">
        <span className="font-mono text-need">DEMO</span>
        <span className="text-mute">
          Algeria · team 2–5 · Brev not used · Sun 27 Sep 2026 · Atlas 320K seeded
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          <button
            disabled={Boolean(busy)}
            onClick={() => post("/api/autopilot/handle-safe", "safe", "/demo")}
            className="rounded-full border border-ok/40 px-3 py-1 text-ok hover:bg-ok hover:text-ink-950 disabled:opacity-50"
          >
            {busy === "safe" ? "Handling…" : "Handle safe actions"}
          </button>
          <button
            disabled={Boolean(busy)}
            onClick={() => post("/api/demo/reset", "reset", "/demo")}
            className="rounded-full border border-white/15 px-3 py-1 text-sand hover:border-paper hover:text-paper disabled:opacity-50"
          >
            {busy === "reset" ? "Resetting…" : "Reset demo"}
          </button>
          <button
            disabled={Boolean(busy)}
            onClick={() => post("/api/demo/supplier-delay", "supplier", "/explore")}
            className="rounded-full border border-need/40 px-3 py-1 text-need hover:bg-need hover:text-ink-950 disabled:opacity-50"
          >
            {busy === "supplier" ? "Cascading…" : "Trigger Supplier Delay"}
          </button>
          <button
            disabled={Boolean(busy)}
            onClick={() => post("/api/demo/shipment-earlier", "earlier", "/warnings")}
            className="rounded-full border border-ok/40 px-3 py-1 text-ok hover:bg-ok hover:text-ink-950 disabled:opacity-50"
          >
            {busy === "earlier" ? "Revising…" : "Earlier arrival"}
          </button>
          <button
            disabled={Boolean(busy)}
            onClick={() => post("/api/demo/discount", "discount", "/exceptions/exc_discount_blocked")}
            className="rounded-full bg-need px-3 py-1 font-medium text-ink-950 hover:bg-paper disabled:opacity-50"
          >
            {busy === "discount" ? "Ingesting…" : "Later message: 10%"}
          </button>
        </span>
        {error ? <span className="w-full text-miss">{error}</span> : null}
      </div>
    </div>
  );
}
