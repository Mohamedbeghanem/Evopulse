import { NextResponse } from "next/server";
import { pendingConnectorActions } from "@/lib/connectors/governance";
import { withConnectors } from "@/lib/connectors/http";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

export async function GET() {
  return withConnectors("read", ({ service }) =>
    NextResponse.json({
      connectors: toPlain(service.list()),
      pending: toPlain(pendingConnectorActions(service.db).map(({ id, type, title, policy_outcome, policy_reason, status, created_at }) => ({ id, type, title, policy_outcome, policy_reason, status, created_at }))),
    }),
  );
}
