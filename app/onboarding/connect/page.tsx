import { ConnectStep } from "@/components/onboarding/OnboardingForms";
import { IntegrationService } from "@/lib/integrations/service";
import { requireOnboarding } from "@/lib/onboarding/guard";
import { toPlain } from "@/lib/plain";

export default async function OnboardingConnectPage() {
  const { workspace, db } = await requireOnboarding();
  return (
    <ConnectStep
      connectors={toPlain(IntegrationService.list(workspace.id))}
      registry={toPlain(IntegrationService.connectors(db, workspace.id))}
    />
  );
}
