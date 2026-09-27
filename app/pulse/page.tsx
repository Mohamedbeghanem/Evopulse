import Link from "next/link";
import { PulseBoard } from "@/components/pulse/PulseBoard";
import { PulseAvatar } from "@/components/pulse-avatar/PulseAvatar";
import { EmptyState, PageHeader } from "@/components/ui/chrome";
import { getMeta, runWithDb } from "@/lib/db";
import { pulseSummary } from "@/lib/engine/pulse";
import { NotificationService } from "@/lib/notifications/service";
import { requireAppUser } from "@/lib/onboarding/guard";
import { DiscoveryService } from "@/lib/discovery/service";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

export default async function UserPulsePage() {
  const ctx = await requireAppUser();
  return runWithDb(ctx.db, () => {
    const pulse = pulseSummary(ctx.db, getMeta(ctx.db, "demo_now"));
    const daily = NotificationService.dailyPulse(ctx.workspace.id, ctx.db, ctx.workspace.agentName);
    const facts = DiscoveryService.list(ctx.workspace.id);
    const hasBusiness = facts.some((fact) => fact.count > 0) || pulse.attention.summary.eventsProcessed > 0;

    if (!hasBusiness && pulse.attention.needsMe.length === 0) {
      return (
        <div className="px-4 py-10 lg:px-8">
          <div className="flex items-start gap-4">
            <PulseAvatar size={48} state="MONITORING" />
            <PageHeader kicker={`${daily.greeting} ${ctx.workspace.agentName}`} title="Your business is running.">
              <p>
                {daily.needsYou} thing{daily.needsYou === 1 ? "" : "s"} need you. {daily.monitoring} monitored.{" "}
                {daily.handled} handled.
              </p>
            </PageHeader>
          </div>
          <div className="mt-8">
            <EmptyState
              title="Connect your business to create your first Pulse."
              body="This workspace is yours. The Atlas demo lives separately and will not appear here."
            />
            <Link href="/settings/integrations" className="mt-4 inline-flex text-need">
              Connect a source
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="border-b border-hairline px-4 py-4 lg:px-8">
          <p className="text-sm text-sand">
            {daily.greeting} {daily.line} {daily.needsYou} need you · {daily.monitoring} monitoring · {daily.handled}{" "}
            handled.
          </p>
        </div>
        <PulseBoard
          pulse={toPlain({ headline: pulse.headline, attention: pulse.attention })}
          companyName={ctx.workspace.name}
        />
      </div>
    );
  });
}
