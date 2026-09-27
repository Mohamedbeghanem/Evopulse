import { MeetStep } from "@/components/onboarding/OnboardingForms";
import { requireOnboarding } from "@/lib/onboarding/guard";

export default async function OnboardingMeetPage() {
  await requireOnboarding();
  return <MeetStep />;
}
