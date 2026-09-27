import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ingestSeedDiscount } from "@/lib/engine/ingest";

export async function POST() {
  const result = await ingestSeedDiscount(getDb());
  return NextResponse.json(result);
}
