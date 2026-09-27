import { NextResponse } from "next/server";
import { emergencyPause } from "@/lib/autonomy";
import { errorResponse, readBody } from "@/lib/autonomy/http";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const body = await readBody(req);
  try {
    return NextResponse.json({ pause: emergencyPause(getDb(), { actor: body.actor, reason: body.reason }) });
  } catch (error) {
    return errorResponse(error);
  }
}
