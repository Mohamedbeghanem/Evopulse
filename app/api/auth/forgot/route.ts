import { NextResponse } from "next/server";
import { AuthService } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const result = AuthService.requestPasswordReset(body.email || "");
  return NextResponse.json({
    ok: true,
    resetHref: result.resetToken ? `/reset-password?token=${result.resetToken}` : null,
  });
}
