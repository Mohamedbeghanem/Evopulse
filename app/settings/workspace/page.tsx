import { WorkspaceForm } from "@/components/user/SettingsForms";
import { PageHeader } from "@/components/ui/chrome";
import { requireAppUser } from "@/lib/onboarding/guard";

export default async function WorkspaceSettingsPage() {
  const { workspace } = await requireAppUser();
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Settings" title="Workspace" />
      <div className="mt-8">
        <WorkspaceForm workspace={workspace} />
      </div>
    </div>
  );
}
