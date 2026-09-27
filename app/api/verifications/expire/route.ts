import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { expireAndRecord } from "@/lib/learning";

export async function POST() {
  const db = getDb();
  const failed = expireAndRecord(db, getMeta(db, "demo_now"));
  return NextResponse.json({ failed });
}
