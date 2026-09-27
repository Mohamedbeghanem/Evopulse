import { ProfileForm } from "@/components/user/SettingsForms";
import { PageHeader } from "@/components/ui/chrome";
import { requireAppUser } from "@/lib/onboarding/guard";

export default async function ProfileSettingsPage() {
  const { user } = await requireAppUser();
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Settings" title="Profile" />
      <div className="mt-8">
        <ProfileForm user={user} />
      </div>
    </div>
  );
}
