import { DiscoveryStep } from "@/components/onboarding/OnboardingForms";
import { requireOnboarding } from "@/lib/onboarding/guard";

export default async function OnboardingDiscoveryPage() {
  await requireOnboarding();
  return <DiscoveryStep />;
}
