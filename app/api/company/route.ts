import { NextResponse } from "next/server";
import { COMPANY_TEMPLATES, companySnapshot } from "@/lib/company";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ...companySnapshot(getDb()),
    templates: COMPANY_TEMPLATES,
  });
}
