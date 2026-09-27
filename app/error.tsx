"use client";

import { ErrorState } from "@/components/ui/chrome";
import { Button } from "@/components/ui/primitives";
import { Workspace } from "@/components/shell/Workspace";

export default function ErrorView({ reset }: { reset: () => void }) {
  return (
    <Workspace>
      <ErrorState title="The operating view failed" body="EvoPulse did not lose business state. Reload the workspace." />
      <div className="mt-4">
        <Button type="button" onClick={reset}>
          Reload
        </Button>
      </div>
    </Workspace>
  );
}
