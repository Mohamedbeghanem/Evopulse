import { ConnectStep } from "@/components/onboarding/OnboardingForms";
import { IntegrationService } from "@/lib/integrations/service";
import { requireOnboarding } from "@/lib/onboarding/guard";

export default async function OnboardingConnectPage() {
  const { workspace } = await requireOnboarding();
  return <ConnectStep connectors={IntegrationService.list(workspace.id)} />;
}
