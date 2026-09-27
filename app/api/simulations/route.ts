import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runSimulation, SimulationError, simulationTargets, stateFingerprint } from "@/lib/simulation";

/** Scenario targets + a fingerprint of real state (used to prove "exit simulation" left reality untouched). */
export async function GET() {
  const db = getDb();
  return NextResponse.json({ ...simulationTargets(db), fingerprint: stateFingerprint(db).hash });
}

/** Run a what-if scenario. Read-only: nothing is persisted. */
export async function POST(req: Request) {
  const db = getDb();
  try {
    const body = await req.json().catch(() => null);
    return NextResponse.json(runSimulation(db, body));
  } catch (error) {
    const status = error instanceof SimulationError ? 400 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "simulation failed" }, { status });
  }
}
