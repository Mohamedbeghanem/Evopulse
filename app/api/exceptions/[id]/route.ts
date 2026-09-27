import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { exceptionDetail } from "@/lib/read";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const detail = exceptionDetail(getDb(), id);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}
