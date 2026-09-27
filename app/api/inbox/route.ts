import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { availableDemoReplies, listInbox } from "@/lib/demo-loop/inbox";

export const GET = withWorkspace(async (ctx) =>
  NextResponse.json({ messages: listInbox(ctx.db), demoReplies: availableDemoReplies(ctx.db) }),
);
