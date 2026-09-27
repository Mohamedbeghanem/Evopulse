import Link from "next/link";
import { ConnectorsAdmin } from "@/components/connectors/ConnectorsAdmin";
import { PageHeader } from "@/components/ui/chrome";
import { resolveRequestContext } from "@/lib/auth";
import { CATALOG } from "@/lib/connectors/catalog";
import { pendingConnectorActions } from "@/lib/connectors/governance";
import { canManageConnectors, roleAllows, visibleConnectors } from "@/lib/connectors/permissions";
import { ConnectorService } from "@/lib/connectors/service";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

const OAUTH_NOTICE: Record<string, string> = {
  denied: "The provider sign-in was cancelled or denied. Nothing was stored.",
  invalid: "The sign-in response was incomplete. Try connecting again.",
  failed: "Sign-in could not be completed. The link may have expired; try again.",
};

export default async function ConnectorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const oauth = typeof params.oauth === "string" ? params.oauth : "";
  const ctx = await resolveRequestContext();
  const isUser = ctx.mode === "user" && ctx.user && ctx.workspace;

  if (!isUser) {
    // Demo / anonymous: catalog only. The canonical Atlas database is never written by a connector.
    return (
      <div className="px-4 py-8 lg:px-8">
        <PageHeader kicker="Workspace" title="Connectors & Plugins">
          <p>
            This is the demo company, so connectors are read-only here.{" "}
            <Link href="/signup" className="text-need underline">
              Create your workspace
            </Link>{" "}
            to import data, connect email or WhatsApp, and add MCP servers.
          </p>
        </PageHeader>
        <div className="mt-8">
          <ConnectorsAdmin catalog={toPlain(CATALOG.map((entry) => ({ ...entry, installs: [] })))} connectors={[]} pending={[]} canAdmin={false} canDecide={false} readOnly />
        </div>
      </div>
    );
  }

  const service = ConnectorService.for(ctx.db, ctx.workspace!.id);
  const role = ctx.role;
  const canAdmin = canManageConnectors(role);
  const pending = pendingConnectorActions(ctx.db).map(({ id, type, title, policy_outcome, policy_reason, status }) => ({
    id,
    type,
    title,
    policy_outcome,
    policy_reason,
    status,
  }));
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Workspace · admin" title="Connectors & Plugins">
        <p>
          Connect apps and MCP servers. Anything they bring in is data, never instructions. Read-only tools run for the agent; every other tool becomes an
          action that Policy checks and a human approves.
        </p>
      </PageHeader>
      <div className="mt-8">
        <ConnectorsAdmin
          catalog={toPlain(service.catalog(role))}
          connectors={toPlain(visibleConnectors(service.list(), role))}
          pending={toPlain(pending)}
          canAdmin={canAdmin}
          canDecide={roleAllows(role, "write")}
          readOnly={role === "viewer"}
          notice={OAUTH_NOTICE[oauth] || null}
        />
      </div>
    </div>
  );
}
