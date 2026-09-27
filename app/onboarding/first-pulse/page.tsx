import { FirstPulseStep } from "@/components/onboarding/OnboardingForms";
import { OnboardingService } from "@/lib/onboarding/service";
import { requireOnboarding } from "@/lib/onboarding/guard";

export default async function OnboardingFirstPulsePage() {
  const { workspace } = await requireOnboarding();
  const first = OnboardingService.firstPulse(workspace.id);
  return (
    <FirstPulseStep
      empty={first.empty}
      needsYou={first.needsYou}
      monitoring={first.monitoring}
      opportunity={first.opportunity}
    />
  );
}
