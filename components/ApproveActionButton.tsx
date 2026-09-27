"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApproveActionButton({ planId, actionId }: { planId: string; actionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/plans/${planId}/actions/${actionId}/approve`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error || "Could not approve");
      return;
    }
    const exec = await fetch(`/api/actions/${actionId}/execute`, { method: "POST" });
    const execData = await exec.json();
    setBusy(false);
    if (!exec.ok) {
      setError(execData.error || "Approved, but execution failed");
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => void run()}
        disabled={busy}
        className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper hover:border-need disabled:opacity-50"
      >
        {busy ? "Approving…" : "Approve"}
      </button>
      {error ? <p className="text-xs text-miss">{error}</p> : null}
    </div>
  );
}
