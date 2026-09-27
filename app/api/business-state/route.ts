import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { getMeta } from "@/lib/db";
import { businessTwin } from "@/lib/engine/twin";
import { pulseSummary } from "@/lib/engine/pulse";

export const GET = withWorkspace(async (ctx) => {
  return NextResponse.json({
    now: getMeta(ctx.db, "demo_now"),
    phase: getMeta(ctx.db, "demo_phase"),
    supplierPhase: getMeta(ctx.db, "supplier_phase", "stable"),
    twin: businessTwin(ctx.db),
    pulse: pulseSummary(ctx.db, getMeta(ctx.db, "demo_now")),
  });
});
