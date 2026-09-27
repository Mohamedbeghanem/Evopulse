import { NextResponse } from "next/server";
import { withHumanActor } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { executeSafeActions } from "@/lib/goals";

export const POST = withHumanActor("write", async (ctx, _body, _req, extra) => {
  const { id } = await (extra as { params: Promise<{ id: string }> }).params;
  try {
    return NextResponse.json(executeSafeActions(ctx.db, id, getMeta(ctx.db, "demo_now"), ctx.actor));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
});
