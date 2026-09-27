import { NextResponse } from "next/server";
import { all, getDb } from "@/lib/db";
import { DecisionLog, type DecisionRow } from "@/lib/autopilot";

/** Audit trail. ?subject_type=exception&subject_id=… for one subject; otherwise latest exception decisions. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const db = getDb();
  const type = url.searchParams.get("subject_type");
  const id = url.searchParams.get("subject_id");
  if ((type === "event" || type === "exception") && id) {
    return NextResponse.json({ decisions: DecisionLog.for(db).history(type, id) });
  }
  const decisions = all<DecisionRow>(
    db,
    "SELECT * FROM autopilot_decisions WHERE subject_type = 'exception' ORDER BY rowid DESC LIMIT 100",
  );
  return NextResponse.json({ decisions });
}
