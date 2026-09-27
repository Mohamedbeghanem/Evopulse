import { NextResponse } from "next/server";
import { returnToCreateSurface } from "@/lib/company";
import { getDb } from "@/lib/db";

export async function POST() {
  return NextResponse.json(returnToCreateSurface(getDb()));
}
