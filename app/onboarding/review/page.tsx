import { ReviewStep } from "@/components/onboarding/OnboardingForms";
import { DiscoveryService } from "@/lib/discovery/service";
import { requireOnboarding } from "@/lib/onboarding/guard";
import { toPlain } from "@/lib/plain";

export default async function OnboardingReviewPage() {
  const { workspace } = await requireOnboarding();
  return <ReviewStep facts={toPlain(DiscoveryService.list(workspace.id))} />;
}
