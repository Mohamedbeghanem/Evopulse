import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eventsFor } from "@/lib/events";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const event = eventsFor(getDb()).getById(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
}
