import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { businessGraph } from "@/lib/engine/graph";

export async function GET(_req: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  const graph = businessGraph(getDb());
  if (entity === "all") return NextResponse.json(graph);
  const connected = new Set<string>([entity]);
  for (const edge of graph.edges) {
    if (edge.from === entity || edge.to === entity) {
      connected.add(edge.from);
      connected.add(edge.to);
    }
  }
  return NextResponse.json({
    nodes: graph.nodes.filter((n) => connected.has(n.id)),
    edges: graph.edges.filter((e) => connected.has(e.from) && connected.has(e.to)),
  });
}
