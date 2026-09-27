import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eventsFor } from "@/lib/events";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await eventsFor(getDb()).replay(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}
