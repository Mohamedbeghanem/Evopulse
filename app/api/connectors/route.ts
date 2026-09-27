import { NextResponse } from "next/server";
import { pendingConnectorActions } from "@/lib/connectors/governance";
import { withConnectors } from "@/lib/connectors/http";
import { canManageConnectors, visibleConnectors } from "@/lib/connectors/permissions";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

/** Catalog + installs. Members/viewers see enabled connectors only, never configuration or credential state. */
export async function GET() {
  return withConnectors("read", ({ service, role }) =>
    NextResponse.json({
      canAdmin: canManageConnectors(role),
      catalog: toPlain(service.catalog(role)),
      connectors: toPlain(visibleConnectors(service.list(), role)),
      pending: toPlain(
        pendingConnectorActions(service.db).map(({ id, type, title, policy_outcome, policy_reason, status, created_at }) => ({
          id,
          type,
          title,
          policy_outcome,
          policy_reason,
          status,
          created_at,
        })),
      ),
    }),
  );
}
