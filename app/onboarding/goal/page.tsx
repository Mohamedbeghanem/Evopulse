import { GoalStep } from "@/components/onboarding/OnboardingForms";
import { requireOnboarding } from "@/lib/onboarding/guard";
import { toPlain } from "@/lib/plain";

export default async function OnboardingGoalPage() {
  const { workspace } = await requireOnboarding();
  return <GoalStep protections={toPlain(workspace.protections)} />;
}
