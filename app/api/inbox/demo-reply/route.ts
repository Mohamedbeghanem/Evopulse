import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { deliverDemoReply, isDemoReplyKey } from "@/lib/demo-loop/inbox";

/** Demo trigger: appends the reply through the same event-ingestion path as POST /api/events. */
export const POST = withWorkspace(async (ctx, req) => {
  const body = (await req.json().catch(() => ({}))) as { reply?: unknown };
  if (!isDemoReplyKey(body.reply)) return NextResponse.json({ error: "Unknown demo reply." }, { status: 400 });
  try {
    return NextResponse.json(deliverDemoReply(ctx.db, body.reply), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 404 });
  }
});
