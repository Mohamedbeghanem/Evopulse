import { WelcomeStep } from "@/components/onboarding/OnboardingForms";
import { requireOnboarding } from "@/lib/onboarding/guard";

export default async function OnboardingWelcomePage() {
  await requireOnboarding();
  return <WelcomeStep />;
}
