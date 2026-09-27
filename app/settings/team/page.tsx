import { TeamForm } from "@/components/user/SettingsForms";
import { PageHeader } from "@/components/ui/chrome";
import { listMemberships } from "@/lib/auth";
import { requireAppUser } from "@/lib/onboarding/guard";

export default async function TeamSettingsPage() {
  const { workspace } = await requireAppUser();
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Settings" title="Team">
        <p>Owner, Admin, Member, Viewer — only roles the product actually enforces.</p>
      </PageHeader>
      <div className="mt-8">
        <TeamForm members={listMemberships(workspace.id)} />
      </div>
    </div>
  );
}
