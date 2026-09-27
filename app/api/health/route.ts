import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness + readiness for container hosts (Fly, Render, Docker HEALTHCHECK).
 * Read-only: it only SELECTs. It never runs detection, never writes business state.
 */
export async function GET() {
  try {
    const db = getDb();
    const probe = db.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
    return NextResponse.json(
      {
        ok: probe?.ok === 1,
        db: "sqlite",
        now: getMeta(db, "demo_now"),
        phase: getMeta(db, "demo_phase"),
        supplier_phase: getMeta(db, "supplier_phase", "stable"),
        node: process.versions.node,
        brev: "not used",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "database unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
