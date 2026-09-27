"use client";

import { ErrorState } from "@/components/ui/chrome";

export default function ErrorView({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4 px-6 py-10">
      <ErrorState title="EvoPulse could not read this surface." body="The engines were not changed. Return to Pulse or retry." />
      <button type="button" onClick={reset} className="font-mono text-sm text-need">
        Retry
      </button>
    </div>
  );
}
