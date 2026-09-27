"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

const EXECUTE_SAFE = (planId: string) => `/api/plans/${planId}/execute-safe`;

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
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(EXECUTE_SAFE(planId), { method: "POST" });
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
      <Button
        type="button"
        variant="primary"
        onClick={() => void run()}
        disabled={busy}
        aria-busy={busy}
        aria-label="Execute AUTO actions only — policy is rechecked first"
      >
        {busy ? "Executing AUTO actions…" : "Execute safe AUTO actions"}
      </Button>
      <p className="text-xs text-mute">
        AUTO only. APPROVAL_REQUIRED and BLOCKED stay put. Policy is rechecked immediately before execution.
      </p>
      {counts ? (
        <p className="text-sm text-ice" role="status">
          {counts.prepared} prepared · {counts.executed} AUTO executed · {counts.waitingForApproval} waiting for
          approval · {counts.blocked} BLOCKED by policy. AUTO_HANDLED is not resolution.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-miss" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
