import { NextResponse } from "next/server";
import { AuthService, assertCanAdmin, authErrorResponse, requireUserContext } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const ctx = await requireUserContext();
    assertCanAdmin(ctx.role === "operator" ? "viewer" : ctx.role!);
    const body = (await req.json()) as {
      name?: string;
      timezone?: string;
      currency?: string;
      logo?: string;
      agent_name?: string;
      interaction_density?: string;
      notification_preference?: string;
    };
    const locked = ["policy", "verification", "approval"];
    if (locked.some((key) => key in body)) {
      return NextResponse.json({ error: "Policy, verification, and approval cannot be turned off." }, { status: 403 });
    }
    const workspace = AuthService.updateWorkspace(ctx.workspace!.id, body);
    return NextResponse.json({ workspace });
  } catch (error) {
    return authErrorResponse(error);
  }
}
