"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

/** Human-only action approval. Never calls the agent tool `approve_action`. */
const HUMAN_APPROVE_ACTION = (planId: string, actionId: string) =>
  `/api/plans/${planId}/actions/${actionId}/approve`;
const HUMAN_EXECUTE_ACTION = (actionId: string) => `/api/actions/${actionId}/execute`;

export function ApproveActionButton({ planId, actionId }: { planId: string; actionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(HUMAN_APPROVE_ACTION(planId, actionId), { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error || "Could not approve");
      return;
    }
    const exec = await fetch(HUMAN_EXECUTE_ACTION(actionId), { method: "POST" });
    const execData = await exec.json();
    setBusy(false);
    if (!exec.ok) {
      setError(execData.error || "Approved, but execution failed — policy rechecked");
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="attention"
        onClick={() => void run()}
        disabled={busy}
        aria-busy={busy}
        aria-label="Approve this action — human authorization only"
      >
        {busy ? "Approving action…" : "Approve this action"}
      </Button>
      {error ? (
        <p className="text-xs text-miss" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
