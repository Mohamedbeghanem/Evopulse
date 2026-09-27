import { NextResponse } from "next/server";
import { AuthError, AuthService, authErrorResponse, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const result = AuthService.login({ email: body.email || "", password: body.password || "" });
    await setSessionCookie(result.session.token);
    return NextResponse.json({
      user: result.user,
      workspace: result.workspace,
      onboardingCompleted: Boolean(result.workspace?.onboardingCompleted),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }
}
