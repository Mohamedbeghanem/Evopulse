import Link from "next/link";
import { Workspace } from "@/components/shell/Workspace";
import { getDb } from "@/lib/db";
import { businessGraph } from "@/lib/engine/graph";

export const dynamic = "force-dynamic";

const ghost =
  "inline-flex min-h-[34px] items-center rounded-lg border border-[#D8DDD6] bg-[#FFFEFB] px-3 text-sm text-[#0D1B24]";

export default function GraphPage() {
  const graph = businessGraph(getDb());
  return (
    <Workspace mode="canvas">
      <div className="bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Commitment graph</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">Atlas 320K + SH-204</h1>
        <p className="mt-2 max-w-[640px] text-[15px] text-[#5C6B73]">
          Persisted nodes and edges. The supplier cascade is stored as data, not drawn by hand.
        </p>
        <p className="mt-3">
          <Link href="/business" className="text-sm text-[#0F4C5C] underline underline-offset-4">
            Business
          </Link>
        </p>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {graph.nodes.map((node) => (
            <div key={node.id} className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#5C6B73]">{node.kind}</p>
              <p className="mt-1 text-base font-semibold">{node.label}</p>
              {node.status ? <p className="text-sm text-[#EC6025]">{node.status}</p> : null}
            </div>
          ))}
        </div>
        <ul className="mt-6 space-y-1 font-mono text-xs text-[#5C6B73]">
          {graph.edges.map((edge, i) => (
            <li key={`${edge.from}-${edge.to}-${i}`}>
              {edge.from} —{edge.label}→ {edge.to}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/explore" className={ghost}>
            Causal explorer
          </Link>
          <Link href="/business" className={ghost}>
            Business Twin
          </Link>
        </div>
      </div>
    </Workspace>
  );
}
