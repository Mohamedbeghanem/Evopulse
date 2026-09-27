export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/ui/chrome";
import { all, runWithDb } from "@/lib/db";
import { requireAppUser } from "@/lib/onboarding/guard";

export default async function ApprovalsPage() {
  const ctx = await requireAppUser();
  const actions = runWithDb(ctx.db, () =>
    all<{ id: string; status: string; title: string }>(
      ctx.db,
      "SELECT id, status, title FROM actions WHERE policy_outcome = 'APPROVAL_REQUIRED' ORDER BY created_at DESC",
    ),
  );
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Control" title="Approvals">
        <p>Decisions that still need your authority.</p>
      </PageHeader>
      <div className="mt-8 space-y-3">
        {actions.length ? (
          actions.map((action) => (
            <article key={action.id} className="rounded-md border border-hairline px-4 py-3">
              <p className="text-paper">{action.title}</p>
              <p className="mt-1 font-mono text-[11px] uppercase text-mute">{action.status}</p>
              <Link href="/command" className="mt-2 inline-flex text-sm text-need">
                Review in Command
              </Link>
            </article>
          ))
        ) : (
          <p className="text-sand">Nothing waiting for approval.</p>
        )}
      </div>
    </div>
  );
}
