import { ProtectStep } from "@/components/onboarding/OnboardingForms";
import { requireOnboarding } from "@/lib/onboarding/guard";

export default async function OnboardingProtectPage() {
  const { workspace } = await requireOnboarding();
  return <ProtectStep selected={workspace.protections} />;
}
