import { NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth";

export async function GET() {
  const ctx = await resolveRequestContext();
  return NextResponse.json({
    mode: ctx.mode,
    user: ctx.user,
    workspace: ctx.workspace,
    role: ctx.role,
  });
}
