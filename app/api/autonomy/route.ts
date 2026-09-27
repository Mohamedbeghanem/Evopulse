import { NextResponse } from "next/server";
import { autonomyOverview } from "@/lib/autonomy";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(autonomyOverview(getDb()));
}
