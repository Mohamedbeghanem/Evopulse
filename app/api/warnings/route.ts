import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { EarlyWarningEngine } from "@/lib/warnings";

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") || undefined;
  const engine = EarlyWarningEngine.for(getDb());
  const rows = status
    ? engine.list(status as "ACTIVE" | "MONITORING" | "RESOLVED" | "ESCALATED" | "DISMISSED")
    : engine.list();
  return NextResponse.json({ warnings: rows.map((row) => engine.summarize(row)) });
}
