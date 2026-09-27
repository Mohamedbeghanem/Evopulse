import { NextResponse } from "next/server";
import { createCompany } from "@/lib/company";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { prompt?: string; template?: string };
  try {
    const snapshot = createCompany(getDb(), { prompt: body.prompt, template: body.template });
    return NextResponse.json(snapshot);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create company" },
      { status: Number.isFinite(status) ? status : 400 },
    );
  }
}
