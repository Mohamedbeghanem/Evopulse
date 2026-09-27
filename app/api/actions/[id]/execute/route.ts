import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { executeAction } from "@/lib/engine/execute";
import { isConnectorAction } from "@/lib/connectors/governance";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const action = db.prepare("SELECT type FROM actions WHERE id = ?").get(id) as { type: string } | undefined;
  if (action && isConnectorAction(action)) {
    return NextResponse.json({ error: "Connector actions execute through /api/connectors/actions." }, { status: 409 });
  }
  try {
    return NextResponse.json(executeAction(db, id, getMeta(db, "demo_now")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}
