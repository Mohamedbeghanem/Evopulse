"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApproveButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/plans/${planId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execute: true }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not approve");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        onClick={run}
        disabled={busy}
        className="rounded-full bg-paper px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-need disabled:opacity-50"
      >
        {busy ? "Executing…" : "Approve & execute recovery"}
      </button>
      {error ? <p className="text-sm text-miss">{error}</p> : null}
    </div>
  );
}
