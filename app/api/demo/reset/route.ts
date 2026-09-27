import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { wipeAndSeed } from "@/lib/seed";

export async function POST() {
  const db = getDb();
  wipeAndSeed(db);
  return NextResponse.json({ ok: true, phase: "seeded" });
}
