import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { all } from "@/lib/db";
import { serializeException } from "@/lib/engine/pulse";
import type { ExceptionRow } from "@/lib/types";

export const GET = withWorkspace(async (ctx) => {
  const rows = all<ExceptionRow>(ctx.db, "SELECT * FROM exceptions ORDER BY created_at DESC");
  return NextResponse.json(rows.map(serializeException));
});
