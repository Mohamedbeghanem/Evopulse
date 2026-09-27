import { NextResponse } from "next/server";
import { all, getDb } from "@/lib/db";
import { serializeException } from "@/lib/engine/pulse";
import type { ExceptionRow } from "@/lib/types";

export async function GET() {
  const rows = all<ExceptionRow>(getDb(), "SELECT * FROM exceptions ORDER BY created_at DESC");
  return NextResponse.json(rows.map(serializeException));
}
