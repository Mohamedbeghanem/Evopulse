import { ConnectStep } from "@/components/onboarding/OnboardingForms";
import { IntegrationService } from "@/lib/integrations/service";
import { requireOnboarding } from "@/lib/onboarding/guard";
import { toPlain } from "@/lib/plain";

export default async function OnboardingConnectPage() {
  const { workspace } = await requireOnboarding();
  return <ConnectStep connectors={toPlain(IntegrationService.list(workspace.id))} />;
}
