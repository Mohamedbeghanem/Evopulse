"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ExecuteSafeButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{
    prepared: number;
    executed: number;
    waitingForApproval: number;
    blocked: number;
  } | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/plans/${planId}/execute-safe`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not execute safe actions");
      return;
    }
    setCounts(data.counts);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => void run()}
        disabled={busy}
        className="animate-throb rounded-full bg-need px-6 py-3 text-sm font-medium text-ink-950 disabled:opacity-50"
      >
        {busy ? "Executing safe actions…" : "Execute safe actions"}
      </button>
      {counts ? (
        <p className="text-sm text-ok">
          {counts.prepared} actions prepared · {counts.executed} executed automatically ·{" "}
          {counts.waitingForApproval} waiting for approval · {counts.blocked} blocked by policy
        </p>
      ) : null}
      {error ? <p className="text-sm text-miss">{error}</p> : null}
    </div>
  );
}
