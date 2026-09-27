import { NextResponse } from "next/server";
import { AuthError, AuthService, authErrorResponse, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string; name?: string };
    const result = AuthService.signup({
      email: body.email || "",
      password: body.password || "",
      name: body.name || "",
    });
    await setSessionCookie(result.session.token);
    return NextResponse.json({
      user: result.user,
      workspace: result.workspace,
      verifyHref: `/verify?token=${result.verifyToken}`,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }
}
