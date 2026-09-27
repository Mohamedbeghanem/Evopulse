import { NextResponse } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { expireAndRecord, VerificationService } from "@/lib/learning";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const exceptionId = url.searchParams.get("exception_id") || undefined;
  const expire = url.searchParams.get("expire") === "1";
  const db = getDb();
  if (expire) expireAndRecord(db, getMeta(db, "demo_now"));
  const pending = VerificationService.for(db).getPendingVerifications(exceptionId);
  return NextResponse.json({ verifications: pending });
}
