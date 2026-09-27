import { NextResponse } from "next/server";
import { openDemoCompany } from "@/lib/company";
import { getDb } from "@/lib/db";

export async function POST() {
  return NextResponse.json(openDemoCompany(getDb()));
}
