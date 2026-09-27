import { BusinessStep } from "@/components/onboarding/OnboardingForms";
import { requireOnboarding } from "@/lib/onboarding/guard";

export default async function OnboardingBusinessPage() {
  const { workspace } = await requireOnboarding();
  return (
    <BusinessStep
      name={workspace.name}
      industry={workspace.industry}
      teamSize={workspace.teamSize}
      country={workspace.country}
      currency={workspace.currency}
    />
  );
}
