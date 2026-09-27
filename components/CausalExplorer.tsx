"use client";

import { useMemo, useState } from "react";
import type { CausalExplorerModel, CausalNodeView } from "@/lib/engine/causal";

export function CausalExplorer({ model }: { model: CausalExplorerModel }) {
  const nodes = useMemo(() => model.columns.flatMap((column) => column.nodes), [model.columns]);
  const initial = nodes.find((node) => node.type === "shipment")?.id ?? nodes[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(initial);
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];

  return (
    <div className="space-y-6">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {model.columns.map((column, index) => (
          <div key={column.key} className="flex items-stretch gap-3">
            {index > 0 ? (
              <div className="flex items-center font-serif text-2xl text-need" aria-hidden>
                ↓
              </div>
            ) : null}
            <section className="w-56 shrink-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">{column.title}</p>
              <div className="mt-2 space-y-2">
                {column.nodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedId(node.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left ${
                      node.id === selected?.id
                        ? "border-need bg-need/10"
                        : "border-white/10 bg-ink-800/40 hover:border-white/25"
                    }`}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">{node.type}</p>
                    <p className="mt-1 font-serif text-lg leading-tight">{node.label}</p>
                    {node.amountLabel ? <p className="mt-2 font-mono text-sm text-need">{node.amountLabel}</p> : null}
                    {node.status ? <p className="mt-1 text-xs uppercase text-sand">{node.status}</p> : null}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ))}
      </div>
      {selected ? <Inspector node={selected} /> : null}
    </div>
  );
}

function Inspector({ node }: { node: CausalNodeView }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-ink-800/50 p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">Inspect · {node.role}</p>
      <h2 className="mt-2 font-serif text-3xl">{node.label}</h2>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <Field k="Source" v={node.source} />
        <Field k="Evidence" v={node.evidence} />
        <Field k="Timestamp" v={node.timestamp || "—"} />
        <Field k="Confidence" v={`${Math.round(node.confidence * 100)}%`} />
        <Field k="Relationship" v={node.relationship || "origin"} />
        <Field k="Value" v={node.amountLabel || "—"} />
      </dl>
      {node.affected.length > 0 ? (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Affected objects</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {node.affected.map((item) => (
              <li key={item.id} className="rounded-full border border-white/10 px-3 py-1 text-xs text-sand">
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
