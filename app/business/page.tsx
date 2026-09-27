import Link from "next/link";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader, SectionHeader } from "@/components/ui/chrome";
import { StatusBadge } from "@/components/ui/badges";
import { withPageContext } from "@/lib/auth/page";
import { businessOverview, type BusinessRow } from "@/lib/business";
import { formatMoney } from "@/lib/clock";
import { businessTwin } from "@/lib/engine/twin";

export const dynamic = "force-dynamic";

function day(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Algiers" });
}

function linked(row: BusinessRow, relationship: string) {
  return row.links
    .filter((link) => link.relationship === relationship)
    .map((link) => link.name)
    .join(", ");
}

export default async function BusinessPage() {
  const { overview, twin } = await withPageContext((ctx) => ({
    overview: businessOverview(ctx.db),
    twin: businessTwin(ctx.db),
  }));
  const { census, canonical } = overview;

  const sections: { title: string; rows: BusinessRow[]; detail: (row: BusinessRow) => string }[] = [
    {
      title: "Suppliers",
      rows: overview.suppliers,
      detail: (row) => [row.role, row.city, linked(row, "supplies") && `supplies ${linked(row, "supplies")}`].filter(Boolean).join(" · "),
    },
    {
      title: "Customers",
      rows: overview.customers,
      detail: (row) => [row.city, linked(row, "belongs_to") && `orders: ${linked(row, "belongs_to")}`].filter(Boolean).join(" · "),
    },
    {
      title: "Orders",
      rows: overview.orders,
      detail: (row) =>
        [
          row.amount != null ? formatMoney(row.amount, row.currency) : "",
          row.dueAt ? `due ${day(row.dueAt)}` : "",
          linked(row, "required_by") && `needs ${linked(row, "required_by")}`,
        ]
          .filter(Boolean)
          .join(" · "),
    },
    {
      title: "Invoices",
      rows: overview.invoices,
      detail: (row) =>
        [row.amount != null ? formatMoney(row.amount, row.currency) : "", row.dueAt ? `due ${day(row.dueAt)}` : "", linked(row, "produces") && `from ${linked(row, "produces")}`]
          .filter(Boolean)
          .join(" · "),
    },
    {
      title: "Products",
      rows: overview.products,
      detail: (row) => [row.sku, row.inventory != null ? `inventory ${row.inventory}` : ""].filter(Boolean).join(" · "),
    },
  ];

  return (
    <Workspace
      mode="operational"
      inspector={
        <InspectorPanel title="Supplier dependency">
          <p>
            {canonical.supplier} → {canonical.shipment} → {canonical.product} → {canonical.orders} orders → {canonical.customers}{" "}
            customers.
          </p>
          <p className="mt-3">
            {formatMoney(canonical.associatedRevenue)} associated revenue · {formatMoney(canonical.expectedCash)} expected cash
            timing. Graph facts, not losses.
          </p>
          <p className="mt-3">Rows marked “on supplier path” sit downstream of {canonical.supplier}.</p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker="Business" title={overview.company.name}>
        <p>
          {[overview.company.city, overview.company.sector?.replaceAll("-", " ")].filter(Boolean).join(" · ")}
        </p>
      </PageHeader>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="business-census">
        <Stat label="Suppliers" value={census.suppliers} />
        <Stat label="Customers" value={census.customers} />
        <Stat label="Orders" value={census.orders} />
        <Stat label="Invoices" value={census.invoices} />
        <Stat label="Commitments" value={census.commitments} />
      </div>

      {sections.map((section) => (
        <section key={section.title} className="mt-10 space-y-2">
          <SectionHeader title={section.title} count={section.rows.length} />
          <ul className="divide-y divide-hairline rounded-md border border-hairline bg-ink-800">
            {section.rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                <span className="text-paper">{row.name}</span>
                <span className="text-sm text-sand">
                  {section.detail(row)}
                  {row.onSupplierPath ? <span className="ml-2 text-need">· on supplier path</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-10 space-y-2">
        <SectionHeader title="Commitments" count={overview.commitments.length} />
        <ul className="divide-y divide-hairline rounded-md border border-hairline bg-ink-800">
          {overview.commitments.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <span className="text-paper">{row.description}</span>
              <span className="text-sm text-sand">
                {row.status}
                {row.deadline ? ` · ${day(row.deadline)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 grid gap-3 md:grid-cols-2">
        {twin.domains.map((domain) => (
          <article key={domain.id} className="rounded-md border border-hairline bg-ink-800 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{domain.id}</p>
            <div className="mt-2">
              <StatusBadge value={domain.status} />
            </div>
            <p className="mt-3 text-sm text-sand">{domain.headline}</p>
          </article>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/agents" className="text-need">
          Agents
        </Link>
        <Link href="/graph" className="text-sand hover:text-paper">
          Graph
        </Link>
        <Link href="/policy" className="text-sand hover:text-paper">
          Policies
        </Link>
      </div>
    </Workspace>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-hairline bg-ink-800 px-3 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{label}</p>
      <p className="mt-1 text-2xl text-paper">{value}</p>
    </div>
  );
}
