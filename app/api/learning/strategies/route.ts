import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { SEED_FOLLOWUP_SIGNATURE, StrategyMemory } from "@/lib/learning";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const signature = url.searchParams.get("context") || SEED_FOLLOWUP_SIGNATURE;
  const evidence = StrategyMemory.for(getDb()).getStrategyEvidence(signature);
  return NextResponse.json(evidence);
}
