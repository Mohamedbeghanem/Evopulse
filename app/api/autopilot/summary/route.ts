import { NextResponse } from "next/server";
import { projectAttention } from "@/lib/attention";
import { getDb, getMeta } from "@/lib/db";

export async function GET() {
  const db = getDb();
  return NextResponse.json(projectAttention(db, getMeta(db, "demo_now")).summary);
}
