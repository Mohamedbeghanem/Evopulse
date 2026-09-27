import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ingestSeedDiscount } from "@/lib/engine/ingest";

export async function POST() {
  try {
    const result = await ingestSeedDiscount(getDb());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}
