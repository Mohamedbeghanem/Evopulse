import { NextResponse } from "next/server";
import { authErrorResponse, requireUserContext } from "@/lib/auth";
import { runWithDb } from "@/lib/db";
import { NotificationService } from "@/lib/notifications/service";

export async function GET() {
  try {
    const ctx = await requireUserContext();
    return runWithDb(ctx.db, () => {
      const notifications = NotificationService.syncFromAttention(ctx.workspace!.id, ctx.db);
      return NextResponse.json({ notifications });
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireUserContext();
    const body = (await req.json()) as { id?: string };
    const notifications = NotificationService.markRead(ctx.workspace!.id, body.id || "");
    return NextResponse.json({ notifications });
  } catch (error) {
    return authErrorResponse(error);
  }
}
