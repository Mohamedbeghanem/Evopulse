import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { receiveCustomerReply } from "@/lib/autopilot";

export async function POST() {
  const result = receiveCustomerReply(getDb());
  if (!result.ok) return NextResponse.json({ error: result.note }, { status: 409 });
  return NextResponse.json(result);
}
