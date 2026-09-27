import { PageHeader } from "@/components/ui/chrome";
import { requireAppUser } from "@/lib/onboarding/guard";

export default async function SecuritySettingsPage() {
  const { user } = await requireAppUser();
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Settings" title="Security">
        <p>
          Signed in as {user.email}. Email {user.emailVerified ? "is verified" : "still needs verification"}. Sessions
          are httpOnly cookies. Workspaces cannot see each other.
        </p>
      </PageHeader>
    </div>
  );
}
