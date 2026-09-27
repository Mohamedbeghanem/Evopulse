import { NextResponse } from "next/server";
import { emergencyResume } from "@/lib/autonomy";
import { errorResponse, readBody } from "@/lib/autonomy/http";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const body = await readBody(req);
  try {
    return NextResponse.json({ pause: emergencyResume(getDb(), { actor: body.actor, reason: body.reason }) });
  } catch (error) {
    return errorResponse(error);
  }
}
