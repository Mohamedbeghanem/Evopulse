import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { pulseSummary } from "@/lib/engine/pulse";

export const GET = withWorkspace(async (ctx) => {
  return NextResponse.json(pulseSummary(ctx.db, getMeta(ctx.db, "demo_now")));
});
