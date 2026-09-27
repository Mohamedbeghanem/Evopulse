import { IntegrationsPanel } from "@/components/user/SettingsForms";
import { PageHeader } from "@/components/ui/chrome";
import { IntegrationService } from "@/lib/integrations/service";
import { requireAppUser } from "@/lib/onboarding/guard";

export default async function IntegrationsSettingsPage() {
  const { workspace } = await requireAppUser();
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Settings" title="Integrations">
        <p>Available connections work. Coming soon stays coming soon.</p>
      </PageHeader>
      <div className="mt-8">
        <IntegrationsPanel connectors={IntegrationService.list(workspace.id)} />
      </div>
    </div>
  );
}
