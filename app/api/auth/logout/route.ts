import { NextResponse } from "next/server";
import { AuthService, clearSessionCookie, readSessionToken } from "@/lib/auth";

export async function POST() {
  const token = await readSessionToken();
  if (token) AuthService.logout(token);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
