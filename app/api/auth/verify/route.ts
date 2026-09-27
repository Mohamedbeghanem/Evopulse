import { NextResponse } from "next/server";
import { AuthError, AuthService, authErrorResponse } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string };
    AuthService.verifyEmail(body.token || "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }
}
