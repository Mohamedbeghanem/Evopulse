import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { calculateGraphImpact, explainWhyAffected } from "@/lib/engine/impact";
import { summarizeDelay } from "@/lib/engine/supplier";
import { graphFor } from "@/lib/graph";
import { IDS } from "@/lib/ids";

export const dynamic = "force-dynamic";

const ghost =
  "inline-flex min-h-[34px] items-center rounded-lg border border-[#D8DDD6] bg-[#FFFEFB] px-3 text-sm text-[#0D1B24]";

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
    <div className="space-y-8 bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Impact · SH-204</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">What the delay touches.</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-[#5C6B73]">
          Observed fact: Atlas Supply moved SH-204 from Monday to Wednesday. The numbers below are
          graph totals — associated revenue and cash timing, not a forecast of loss.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill>OBSERVED FACT</Pill>
          <Pill>DETERMINISTIC CALCULATION</Pill>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2">
        <Fact k="Associated revenue" v={formatMoney(impact.associated_revenue)} caption={`${impact.affected_orders.length} orders · ${impact.affected_customers.length} customers`} />
        <Fact k="Expected cash timing" v={formatMoney(impact.affected_expected_cash)} caption="Timing, not lost cash" />
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <Fact k="Orders" v={String(impact.affected_orders.length)} />
        <Fact k="Customers" v={String(impact.affected_customers.length)} />
      </section>

      <section className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Causal chain</p>
        <div className="mt-4 space-y-3 text-base font-semibold">
          <p>Atlas Supply</p>
          <p className="text-[#EC6025]">↓ supplies · SH-204 · +2 days</p>
          <p>Pallet racking kit RK-7</p>
          <p className="text-[#5C6B73]">↓ required_by</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-[0.12em] text-[#5C6B73]">
                <th className="border-b border-[#D8DDD6] px-2 py-2.5 font-semibold">Order</th>
                <th className="border-b border-[#D8DDD6] px-2 py-2.5 font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {impact.affected_orders.map((order) => (
                <tr key={order.id}>
                  <td className="border-b border-[#D8DDD6] px-2 py-2.5">
                    <span className="font-mono text-[11px] text-[#5C6B73]">{order.id}</span>
                    <span className="mt-0.5 block font-semibold">{order.label}</span>
                  </td>
                  <td className="border-b border-[#D8DDD6] px-2 py-2.5 font-mono text-[#EC6025]">
                    {formatMoney(order.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[#5C6B73]">↓ belongs_to</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {impact.affected_customers.map((customer) => (
            <div key={customer.id} className="rounded-[14px] border border-[#D8DDD6] bg-[#F7F8F5] p-4">
              <p className="text-base font-semibold">{customer.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-[#5C6B73]">↓ invoices · expected cash {formatMoney(impact.affected_expected_cash)}</p>
        {impact.affected_invoices.length ? (
          <ul className="mt-3 space-y-2">
            {impact.affected_invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span>{invoice.label}</span>
                <span className="font-mono">{formatMoney(invoice.amount)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Why is Order B affected?</p>
        <p className="mt-3 text-[22px] font-semibold tracking-tight">{whyB}</p>
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

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/exceptions/${IDS.excDelay}`}
          className="inline-flex min-h-[34px] items-center rounded-lg bg-[#0D1B24] px-3 text-sm font-medium text-white"
        >
          Open exception
        </Link>
        <Link href="/explore" className={ghost}>
          Causal explorer
        </Link>
        <Link href="/graph" className={ghost}>
          Full graph
        </Link>
        <Link href="/simulate" className={ghost}>
          What if it gets later? Simulate
        </Link>
      </div>
    </div>
  );
}

function Fact({ k, v, caption }: { k: string; v: string; caption?: string }) {
  return (
    <div className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5C6B73]">{k}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-tight">{v}</p>
      {caption ? <p className="mt-1 text-xs text-[#5C6B73]">{caption}</p> : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#5C6B73]">{k}</dt>
      <dd className="text-right text-[#0D1B24]">{v}</dd>
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-full bg-[#E8F1F4] px-2 text-[11px] font-semibold tracking-wide text-[#0F4C5C]">
      {children}
    </span>
  );
}
