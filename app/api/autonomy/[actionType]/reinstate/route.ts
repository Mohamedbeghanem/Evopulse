import { NextResponse } from "next/server";
import { reinstateAction } from "@/lib/autonomy";
import { errorResponse, readBody } from "@/lib/autonomy/http";
import { getDb } from "@/lib/db";

export async function POST(req: Request, ctx: { params: Promise<{ actionType: string }> }) {
  const { actionType } = await ctx.params;
  const body = await readBody(req);
  try {
    const profile = reinstateAction(getDb(), actionType, { actor: body.actor, reason: body.reason });
    return NextResponse.json({ profile });
  } catch (error) {
    return errorResponse(error);
  }
}
