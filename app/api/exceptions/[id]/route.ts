import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { exceptionDetail } from "@/lib/read";

export const GET = withWorkspace(async (ctx, _req, extra) => {
  const { id } = await ((extra as { params: Promise<{ id: string }> } | undefined)?.params ?? Promise.resolve({ id: "" }));
  const detail = exceptionDetail(ctx.db, id);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
});
