import { NextResponse } from "next/server";
import {
  AuthService,
  assertCanAdmin,
  authErrorResponse,
  listMemberships,
  requireUserContext,
  type WorkspaceRole,
} from "@/lib/auth";

export async function GET() {
  try {
    const ctx = await requireUserContext();
    return NextResponse.json({ members: listMemberships(ctx.workspace!.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireUserContext();
    const role = ctx.role === "operator" ? "viewer" : ctx.role!;
    assertCanAdmin(role);
    const body = (await req.json()) as { email?: string; role?: WorkspaceRole; userId?: string };
    if (body.userId && body.role) {
      const members = AuthService.updateMemberRole(ctx.workspace!.id, role, body.userId, body.role);
      return NextResponse.json({ members });
    }
    const members = AuthService.addMember(ctx.workspace!.id, role, body.email || "", body.role || "member");
    return NextResponse.json({ members });
  } catch (error) {
    return authErrorResponse(error);
  }
}
