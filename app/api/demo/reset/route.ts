import { NextResponse } from "next/server";
import { resetWorkspace } from "@/lib/company";
import { getDb, getMeta } from "@/lib/db";

export async function POST() {
  const snapshot = resetWorkspace(getDb());
  return NextResponse.json({
    ok: true,
    phase: getMeta(getDb(), "demo_phase", "seeded"),
    supplier_phase: getMeta(getDb(), "supplier_phase", "stable"),
    workspace_mode: snapshot.mode,
  });
}
