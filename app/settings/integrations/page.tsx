import Link from "next/link";
import { IntegrationsPanel } from "@/components/user/SettingsForms";
import { PageHeader } from "@/components/ui/chrome";
import { IntegrationService } from "@/lib/integrations/service";
import { requireAppUser } from "@/lib/onboarding/guard";
import { toPlain } from "@/lib/plain";

export default async function IntegrationsSettingsPage() {
  const { workspace } = await requireAppUser();
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Settings" title="Integrations">
        <p>Available connections work. Coming soon stays coming soon.</p>
      </PageHeader>
      <Link
        href="/connectors"
        className="mt-6 flex items-center justify-between rounded-md border border-need/40 px-4 py-3 text-sm text-paper hover:border-need"
      >
        <span>
          Connectors &amp; Plugins
          <span className="block text-xs text-sand">CSV / Excel import, Email (IMAP), WhatsApp Business, MCP servers, outbound channels.</span>
        </span>
        <span className="font-mono text-[11px] uppercase text-need">Open</span>
      </Link>
      <div className="mt-8">
        <IntegrationsPanel connectors={toPlain(IntegrationService.list(workspace.id))} />
      </div>
    </div>
  );
}
