import { NextResponse } from "next/server";
import { suspendAction } from "@/lib/autonomy";
import { errorResponse, readBody } from "@/lib/autonomy/http";
import { getDb } from "@/lib/db";

export async function POST(req: Request, ctx: { params: Promise<{ actionType: string }> }) {
  const { actionType } = await ctx.params;
  const body = await readBody(req);
  try {
    const profile = suspendAction(getDb(), actionType, { actor: body.actor, reason: body.reason });
    return NextResponse.json({ profile });
  } catch (error) {
    return errorResponse(error);
  }
}
