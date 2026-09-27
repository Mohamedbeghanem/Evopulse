import { NextResponse } from "next/server";
import { AutonomyError } from "./service";

/** Shared body parsing + error mapping for /api/autonomy routes. */
export async function readBody(req: Request): Promise<{ actor?: string; reason?: string; toLevel?: number }> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    actor: typeof body.actor === "string" ? body.actor : undefined,
    reason: typeof body.reason === "string" ? body.reason : undefined,
    toLevel: typeof body.toLevel === "number" ? body.toLevel : undefined,
  };
}

export function errorResponse(error: unknown) {
  if (error instanceof AutonomyError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 500 });
}
