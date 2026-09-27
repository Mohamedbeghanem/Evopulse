import Link from "next/link";
import { EmptyState } from "@/components/ui/chrome";

export default function NotFound() {
  return (
    <div className="px-6 py-10">
      <EmptyState title="This object is not on the twin." body="Pulse still knows what needs you." />
      <Link href="/" className="mt-4 inline-block text-sm text-need underline underline-offset-4">
        Return to Pulse
      </Link>
    </div>
  );
}
