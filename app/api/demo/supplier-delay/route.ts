import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { triggerSupplierDelay } from "@/lib/engine/supplier";

export async function POST() {
  return NextResponse.json(triggerSupplierDelay(getDb()));
}
