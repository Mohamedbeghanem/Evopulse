import { PageHeader } from "@/components/ui/chrome";
import { requireAppUser } from "@/lib/onboarding/guard";

export default async function AiSettingsPage() {
  const { workspace } = await requireAppUser();
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Settings" title="AI preferences">
        <p>
          Agent name: {workspace.agentName}. Density: {workspace.interactionDensity}. Policy and verification stay
          required.
        </p>
      </PageHeader>
    </div>
  );
}
