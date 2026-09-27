import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { OutcomeLedger, SEED_FOLLOWUP_SIGNATURE } from "@/lib/learning";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const signature = url.searchParams.get("context") || SEED_FOLLOWUP_SIGNATURE;
  const rows = OutcomeLedger.for(getDb()).listByContext(signature);
  return NextResponse.json({
    context_signature: signature,
    count: rows.length,
    outcomes: rows,
    note: "Includes synthetic historical seed rows (id prefix syn_out_). Rates must be derived from these rows.",
  });
}
