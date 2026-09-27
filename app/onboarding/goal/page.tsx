import { GoalStep } from "@/components/onboarding/OnboardingForms";
import { requireOnboarding } from "@/lib/onboarding/guard";

export default async function OnboardingGoalPage() {
  const { workspace } = await requireOnboarding();
  return <GoalStep protections={workspace.protections} />;
}
