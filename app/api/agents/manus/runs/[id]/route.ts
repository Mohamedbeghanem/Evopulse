import { NextResponse } from "next/server";
import { loadManusRun } from "@/lib/agents/manus";
import { withWorkspace } from "@/lib/auth";

export const GET = withWorkspace(async (ctx, req, context) => {
  const params = (context as { params: Promise<{ id: string }> } | undefined)?.params;
  const { id } = params ? await params : { id: new URL(req.url).pathname.split("/").at(-1) || "" };
  try {
    return NextResponse.json({ run: loadManusRun(ctx.db, id) });
  } catch {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
});
