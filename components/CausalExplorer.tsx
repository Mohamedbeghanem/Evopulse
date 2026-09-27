"use client";

import { useMemo, useState } from "react";
import { NOT_A_LOSS, presentCausalImpact } from "@/components/sim/copy";
import type { CausalExplorerModel, CausalNodeView } from "@/lib/engine/causal";

export function CausalExplorer({ model }: { model: CausalExplorerModel }) {
  const impact = useMemo(() => presentCausalImpact(model), [model]);
  const nodes = useMemo(() => model.columns.flatMap((column) => column.nodes), [model.columns]);
  const initial = nodes.find((node) => node.type === "shipment")?.id ?? nodes[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(initial);
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];

  return (
    <div className="space-y-6 font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">
          Cause → event → dependency → consequence
        </p>
        <p className="mt-2 text-[15px]">{impact.chain}</p>
        <p className="mt-2 text-sm text-[#5C6B73]">
          {impact.associated.value} associated · {impact.cashTiming.value} cash timing. {NOT_A_LOSS}
        </p>
      </section>

      <p className="flex flex-wrap items-center gap-2 text-[13px]">
        {model.columns.map((column, index) => (
          <span key={column.key} className="contents">
            {index > 0 ? <span className="text-[#5C6B73]">→</span> : null}
            {column.nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedId(node.id)}
                className={`rounded-[14px] border bg-[#FFFEFB] px-3 py-2 text-left ${
                  node.id === selected?.id
                    ? "border-[#EC6025] shadow-[inset_2px_0_0_#EC6025]"
                    : "border-[#D8DDD6] hover:border-[#EC6025]/40"
                }`}
              >
                {node.label}
              </button>
            ))}
          </span>
        ))}
      </p>

      <div className="flex flex-wrap gap-x-4 gap-y-6">
        {model.columns.map((column) => (
          <section key={column.key} className="min-w-[11rem] max-w-full flex-1 basis-[11rem]">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#5C6B73]">{column.title}</p>
            <div className="mt-2 space-y-2">
              {column.nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedId(node.id)}
                  className={`w-full rounded-[14px] border bg-[#FFFEFB] px-3 py-3 text-left ${
                    node.id === selected?.id
                      ? "border-[#EC6025] shadow-[inset_2px_0_0_#EC6025]"
                      : "border-[#D8DDD6] hover:border-[#EC6025]/40"
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5C6B73]">{node.type}</p>
                  <p className="mt-1 text-base font-semibold leading-tight">{node.label}</p>
                  {node.amountLabel ? (
                    <p className="mt-2 font-mono text-sm text-[#0D1B24]">
                      {node.amountLabel}
                      <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-[#5C6B73]">
                        {node.type === "invoice" || node.type === "cash" ? "cash timing" : "associated"}
                      </span>
                    </p>
                  ) : null}
                  {node.status ? <p className="mt-1 text-xs uppercase text-[#EC6025]">{node.status}</p> : null}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {selected ? <Inspector node={selected} /> : null}
    </div>
  );
}

function Inspector({ node }: { node: CausalNodeView }) {
  const moneyKind = node.type === "invoice" || node.type === "cash" ? "Expected cash timing" : "Associated value";
  return (
    <section className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Inspect · {node.role}</p>
      <h2 className="mt-2 text-[22px] font-semibold tracking-tight">{node.label}</h2>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <Field k="Caused by" v={node.source} />
        <Field k="Evidence" v={node.evidence} />
        <Field k="Timestamp" v={node.timestamp || "—"} />
        <Field k="Confidence" v={`${Math.round(node.confidence * 100)}%`} />
        <Field k="Relationship" v={node.relationship || "origin"} />
        <Field k={moneyKind} v={node.amountLabel ? `${node.amountLabel} · ${NOT_A_LOSS}` : "—"} />
      </dl>
      {node.affected.length > 0 ? (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#5C6B73]">Affects</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {node.affected.map((item) => (
              <li key={item.id} className="rounded-lg border border-[#D8DDD6] bg-[#FFFEFB] px-3 py-1 text-xs text-[#5C6B73]">
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#5C6B73]">Nothing downstream of this node.</p>
      )}
    </section>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[#5C6B73]">{k}</dt>
      <dd className="mt-1 text-[#0D1B24]">{v}</dd>
    </div>
  );
}
