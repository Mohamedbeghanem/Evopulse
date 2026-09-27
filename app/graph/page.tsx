import { Workspace } from "@/components/shell/Workspace";
import { PageHeader } from "@/components/ui/chrome";
import { getDb } from "@/lib/db";
import { businessGraph } from "@/lib/engine/graph";

export const dynamic = "force-dynamic";

export default function GraphPage() {
  const graph = businessGraph(getDb());
  return (
    <Workspace mode="canvas">
      <PageHeader kicker="Business · Graph" title="Atlas 320K + SH-204">
        <p>Persisted nodes and edges. The supplier cascade is stored as data, not drawn by hand.</p>
      </PageHeader>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {graph.nodes.map((node) => (
          <div key={node.id} className="rounded-2xl border border-white/10 bg-ink-800/40 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{node.kind}</p>
            <p className="mt-1 font-serif text-xl">{node.label}</p>
            {node.status ? <p className="text-sm text-need">{node.status}</p> : null}
          </div>
        ))}
      </div>
      <ul className="mt-6 space-y-1 font-mono text-xs text-mute">
        {graph.edges.map((edge, i) => (
          <li key={`${edge.from}-${edge.to}-${i}`}>
            {edge.from} —{edge.label}→ {edge.to}
          </li>
        ))}
      </ul>
    </Workspace>
  );
}
