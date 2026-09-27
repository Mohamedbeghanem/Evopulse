import { ProtectStep } from "@/components/onboarding/OnboardingForms";
import { requireOnboarding } from "@/lib/onboarding/guard";
import { toPlain } from "@/lib/plain";

export default async function OnboardingProtectPage() {
  const { workspace } = await requireOnboarding();
  return <ProtectStep selected={toPlain(workspace.protections)} />;
}
