import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildTimeline } from "@/lib/engine/timeline";

export async function GET() {
  return NextResponse.json(buildTimeline(getDb()));
}
