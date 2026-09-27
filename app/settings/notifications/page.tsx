import { PageHeader } from "@/components/ui/chrome";
import { requireAppUser } from "@/lib/onboarding/guard";

export default async function NotificationSettingsPage() {
  const { workspace } = await requireAppUser();
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Settings" title="Notifications">
        <p>Current preference: {workspace.notificationPreference}. One situation produces one alert.</p>
      </PageHeader>
    </div>
  );
}
