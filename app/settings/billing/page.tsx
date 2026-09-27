import { PageHeader } from "@/components/ui/chrome";
import { requireAppUser } from "@/lib/onboarding/guard";

export default async function BillingSettingsPage() {
  await requireAppUser();
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Settings" title="Billing">
        <p>Billing is not enabled yet. This page is a shell — no charges, no fake invoices.</p>
      </PageHeader>
    </div>
  );
}
