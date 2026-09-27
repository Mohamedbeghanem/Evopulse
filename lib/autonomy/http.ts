import { NextResponse } from "next/server";
import { AutonomyError } from "./service";

/** Shared error mapping for /api/autonomy routes. The actor comes from the session (lib/auth/actor), never the body. */
export function errorResponse(error: unknown) {
  if (error instanceof AutonomyError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 500 });
}
