import { NextResponse } from "next/server";
import { AuthService, authErrorResponse, requireUserContext } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const ctx = await requireUserContext();
    const body = (await req.json()) as { name?: string };
    const user = AuthService.updateProfile(ctx.user!.id, { name: body.name });
    return NextResponse.json({ user });
  } catch (error) {
    return authErrorResponse(error);
  }
}
