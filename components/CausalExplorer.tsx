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
    <div className="space-y-6">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">Cause → event → dependency → consequence</p>
        <p className="mt-2 text-xl text-paper">{impact.chain}</p>
        <p className="mt-2 text-sm text-sand">
          {impact.associated.value} associated · {impact.cashTiming.value} cash timing. {NOT_A_LOSS}
        </p>
      </section>

      <div className="flex flex-wrap gap-x-4 gap-y-6">
        {model.columns.map((column) => (
          <section key={column.key} className="min-w-[11rem] max-w-full flex-1 basis-[11rem]">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">{column.title}</p>
            <div className="mt-2 space-y-2">
              {column.nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedId(node.id)}
                  className={`w-full rounded-md border px-3 py-3 text-left ${
                    node.id === selected?.id
                      ? "border-need bg-need/10"
                      : "border-hairline bg-ink-800/40 hover:border-white/25"
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">{node.type}</p>
                  <p className="mt-1 text-lg leading-tight text-paper">{node.label}</p>
                  {node.amountLabel ? (
                    <p className="mt-2 font-mono text-sm text-sand">
                      {node.amountLabel}
                      <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-mute">
                        {node.type === "invoice" || node.type === "cash" ? "cash timing" : "associated"}
                      </span>
                    </p>
                  ) : null}
                  {node.status ? <p className="mt-1 text-xs uppercase text-sand">{node.status}</p> : null}
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
    <section className="rounded-md border border-hairline bg-ink-800/50 p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">Inspect · {node.role}</p>
      <h2 className="mt-2 text-3xl text-paper">{node.label}</h2>
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
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Affects</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {node.affected.map((item) => (
              <li key={item.id} className="rounded-md border border-hairline px-3 py-1 text-xs text-sand">
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-mute">Nothing downstream of this node.</p>
      )}
    </section>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-mute">{k}</dt>
      <dd className="mt-1 text-paper">{v}</dd>
    </div>
  );
}
