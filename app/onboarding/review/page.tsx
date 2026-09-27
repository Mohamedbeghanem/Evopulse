import { ReviewStep } from "@/components/onboarding/OnboardingForms";
import { DiscoveryService } from "@/lib/discovery/service";
import { requireOnboarding } from "@/lib/onboarding/guard";

export default async function OnboardingReviewPage() {
  const { workspace } = await requireOnboarding();
  return <ReviewStep facts={DiscoveryService.list(workspace.id)} />;
}
