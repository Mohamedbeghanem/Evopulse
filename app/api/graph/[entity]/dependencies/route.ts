import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getDependencies, getDownstream, getUpstream } from "@/lib/graph";

export async function GET(_req: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  const db = getDb();
  return NextResponse.json({
    entity,
    upstream: getUpstream(db, entity),
    downstream: getDownstream(db, entity),
    dependencies: getDependencies(db, entity),
  });
}
