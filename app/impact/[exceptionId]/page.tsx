import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { formatMoney } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { calculateGraphImpact, explainWhyAffected } from "@/lib/engine/impact";
import { summarizeDelay } from "@/lib/engine/supplier";
import { graphFor } from "@/lib/graph";
import { IDS } from "@/lib/ids";

export const dynamic = "force-dynamic";

export default async function ImpactPage({ params }: { params: Promise<{ exceptionId: string }> }) {
  const { exceptionId } = await params;
  if (exceptionId !== IDS.excDelay) notFound();
  const db = getDb();
  const delay = summarizeDelay(db);
  if (!delay.exception) notFound();
  const impact = calculateGraphImpact(db, IDS.shipment);
  const graph = graphFor(db);
  const selected = graph.getNode(IDS.orderB);
  const whyB = explainWhyAffected(db, IDS.shipment, IDS.orderB);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Impact explorer</p>
        <h1 className="mt-2 font-serif text-5xl">Supplier delay +2 days</h1>
        <p className="mt-3 max-w-2xl text-sand">
          Observed fact: Atlas Supply moved SH-204 from Monday to Wednesday. The numbers below are
          graph totals — associated revenue and cash timing, not a forecast of loss.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>OBSERVED FACT</Badge>
          <Badge>DETERMINISTIC CALCULATION</Badge>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Fact k="Orders" v={String(impact.affected_orders.length)} />
        <Fact k="Customers" v={String(impact.affected_customers.length)} />
        <Fact k="Associated revenue" v={formatMoney(impact.associated_revenue)} />
        <Fact k="Expected cash timing" v={formatMoney(impact.affected_expected_cash)} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-ink-800/40 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Causal chain</p>
        <div className="mt-4 space-y-3 font-serif text-2xl">
          <p>Atlas Supply</p>
          <p className="text-need">↓ supplies · SH-204 · +2 days</p>
          <p>Pallet racking kit RK-7</p>
          <p className="text-mute">↓ required_by</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {impact.affected_orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-white/10 p-4">
              <p className="font-mono text-[11px] text-mute">{order.id}</p>
              <p className="mt-1 font-serif text-xl">{order.label}</p>
              <p className="mt-2 font-mono text-need">{formatMoney(order.amount)}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-mute">↓ belongs_to</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {impact.affected_customers.map((customer) => (
            <div key={customer.id} className="rounded-xl bg-ink-900/50 p-4">
              <p className="font-serif text-lg">{customer.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-sand">↓ invoices · expected cash {formatMoney(impact.affected_expected_cash)}</p>
      </section>

      <section className="rounded-2xl border border-white/10 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Why is Order B affected?</p>
        <p className="mt-3 font-serif text-2xl">{whyB}</p>
        {selected ? (
          <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
            <Row k="Type" v={selected.type} />
            <Row k="Relationship" v="required_by (via RK-7)" />
            <Row k="Source" v="Supplier message" />
            <Row k="Evidence" v={delay.message} />
            <Row k="Value" v={formatMoney(impact.affected_orders.find((order) => order.id === IDS.orderB)?.amount ?? 0)} />
            <Row k="Confidence" v="96%" />
            <Row k="Timestamp" v={delay.change?.created_at || ""} />
          </dl>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/exceptions/${IDS.excDelay}`}
          className="rounded-full bg-paper px-5 py-2.5 text-sm font-medium text-ink-950"
        >
          Open exception
        </Link>
        <Link href="/explore" className="rounded-full border border-white/15 px-5 py-2.5 text-sm">
          Causal explorer
        </Link>
        <Link href="/graph" className="rounded-full border border-white/15 px-5 py-2.5 text-sm">
          Full graph
        </Link>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{k}</p>
      <p className="mt-2 font-serif text-2xl">{v}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-mute">{k}</dt>
      <dd className="text-right text-paper">{v}</dd>
    </div>
  );
}
