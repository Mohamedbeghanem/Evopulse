import { getDb } from "@/lib/db";
import { businessGraph } from "@/lib/engine/graph";

export const dynamic = "force-dynamic";

export default function GraphPage() {
  const graph = businessGraph(getDb());
  return (
    <div className="space-y-8 px-6 py-8 lg:px-10">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Business graph</p>
        <h1 className="mt-2 font-serif text-5xl">Atlas 320K + SH-204</h1>
        <p className="mt-3 max-w-2xl text-sand">
          Persisted nodes and edges. The 320K commitment chain stays; the supplier cascade is stored
          as data, not drawn by hand.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {graph.nodes.map((node) => (
          <div key={node.id} className="rounded-2xl border border-white/10 bg-ink-800/40 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{node.kind}</p>
            <p className="mt-1 font-serif text-xl">{node.label}</p>
            {node.status ? <p className="text-sm text-need">{node.status}</p> : null}
          </div>
        ))}
      </div>
      <ul className="space-y-1 font-mono text-xs text-mute">
        {graph.edges.map((edge, i) => (
          <li key={`${edge.from}-${edge.to}-${i}`}>
            {edge.from} —{edge.label}→ {edge.to}
          </li>
        ))}
      </ul>
    </div>
  );
}
