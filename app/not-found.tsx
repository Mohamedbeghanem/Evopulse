import Link from "next/link";
import { EmptyState } from "@/components/ui/chrome";
import { Workspace } from "@/components/shell/Workspace";

export default function NotFound() {
  return (
    <Workspace>
      <EmptyState title="That surface is not here" body="Return to Pulse. Contextual tools stay reachable from the situation, not a missing URL." />
      <Link href="/" className="mt-4 inline-flex text-sm text-need">
        Back to Pulse
      </Link>
    </Workspace>
  );
}
