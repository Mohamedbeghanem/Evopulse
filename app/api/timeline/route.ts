import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { buildTimeline } from "@/lib/engine/timeline";

export const GET = withWorkspace(async (ctx) => {
  return NextResponse.json(buildTimeline(ctx.db));
});
