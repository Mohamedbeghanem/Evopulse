import Link from "next/link";
import { PageHeader } from "@/components/ui/chrome";
import { runWithDb } from "@/lib/db";
import { NotificationService } from "@/lib/notifications/service";
import { requireAppUser } from "@/lib/onboarding/guard";

const LABELS = {
  NEEDS_YOU: "Needs you",
  NEEDS_APPROVAL: "Needs approval",
  MONITORING: "Monitoring",
  HANDLED: "Handled",
} as const;

export default async function NotificationsPage() {
  const ctx = await requireAppUser();
  const notifications = runWithDb(ctx.db, () => NotificationService.syncFromAttention(ctx.workspace.id, ctx.db));
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Inbox" title="Notifications">
        <p>One situation, one alert. Open it to see evidence.</p>
      </PageHeader>
      <div className="mt-8 space-y-3">
        {notifications.length ? (
          notifications.map((item) => (
            <Link key={item.id} href={item.href || "/pulse"} className="block rounded-md border border-hairline px-4 py-3">
              <p className="font-mono text-[10px] uppercase text-mute">{LABELS[item.category]}</p>
              <p className="mt-1 text-paper">{item.title}</p>
              <p className="mt-1 text-sm text-sand">{item.body}</p>
            </Link>
          ))
        ) : (
          <p className="text-sand">Nothing waiting. Pulse will write here when a situation needs you.</p>
        )}
      </div>
    </div>
  );
}
