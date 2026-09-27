"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

/** Human-only plan approval. Never calls the agent tool `approve_action`. */
const HUMAN_APPROVE_PLAN = (planId: string) => `/api/plans/${planId}/approve`;

export function ApproveButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(HUMAN_APPROVE_PLAN(planId), {
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
      <Button
        type="button"
        variant="attention"
        onClick={() => void run()}
        disabled={busy}
        aria-busy={busy}
        aria-label="Approve and execute recovery — human authorization only"
      >
        {busy ? "Executing recovery…" : "Approve & execute recovery"}
      </Button>
      <p className="text-xs text-mute">Human authorization only. Policy is rechecked before execution. AI cannot approve itself.</p>
      {error ? (
        <p className="text-sm text-miss" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
