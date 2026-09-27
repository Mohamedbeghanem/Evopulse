import Link from "next/link";
import { PageHeader } from "@/components/ui/chrome";
import { requireAppUser } from "@/lib/onboarding/guard";
import { loadPolicies } from "@/lib/engine/policy";
import { runWithDb } from "@/lib/db";

export default async function PoliciesSettingsPage() {
  const ctx = await requireAppUser();
  const policies = runWithDb(ctx.db, () => loadPolicies(ctx.db));
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Settings" title="Policies">
        <p>These gates stay on. Pulse cannot approve itself or skip verification.</p>
      </PageHeader>
      <ul className="mt-8 space-y-3">
        {Object.entries(policies).map(([key, value]) => (
          <li key={key} className="rounded-md border border-hairline px-3 py-3">
            <p className="font-mono text-[11px] uppercase text-mute">{key}</p>
            <p className="mt-1 text-paper">{value}</p>
          </li>
        ))}
      </ul>
      <Link href="/policy" className="mt-6 inline-flex text-sm text-need">
        Open Control OS policy view
      </Link>
    </div>
  );
}
