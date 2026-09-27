import Link from "next/link";
import { ConnectorsBoard } from "@/components/connectors/ConnectorsBoard";
import { PageHeader } from "@/components/ui/chrome";
import { resolveRequestContext } from "@/lib/auth";
import { pendingConnectorActions } from "@/lib/connectors/governance";
import { ConnectorRegistry } from "@/lib/connectors/registry";
import { ConnectorService } from "@/lib/connectors/service";
import { getDb } from "@/lib/db";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

export default async function ConnectorsPage() {
  const ctx = await resolveRequestContext();
  const isUser = ctx.mode === "user" && ctx.user && ctx.workspace;

  if (!isUser) {
    // Demo / anonymous: catalog only. The canonical Atlas database is never written by a connector.
    const connectors = ConnectorRegistry.for(getDb(), "ws_demo").list();
    return (
      <div className="px-4 py-8 lg:px-8">
        <PageHeader kicker="Workspace" title="Connectors & Plugins">
          <p>
            This is the demo company, so connectors are read-only here.{" "}
            <Link href="/signup" className="text-need underline">
              Create your workspace
            </Link>{" "}
            to import your data, connect email or WhatsApp, and register MCP servers.
          </p>
        </PageHeader>
        <div className="mt-8">
          <ConnectorsBoard connectors={toPlain(connectors)} pending={[]} readOnly canAdmin={false} />
        </div>
      </div>
    );
  }

  const service = ConnectorService.for(ctx.db, ctx.workspace!.id);
  const pending = pendingConnectorActions(ctx.db).map(({ id, type, title, policy_outcome, policy_reason, status }) => ({
    id,
    type,
    title,
    policy_outcome,
    policy_reason,
    status,
  }));
  const role = ctx.role;
  return (
    <div className="px-4 py-8 lg:px-8">
      <PageHeader kicker="Workspace" title="Connectors & Plugins">
        <p>
          Real sources only. Anything a connector brings in is data, never instructions. Anything that writes or sends goes through Policy and,
          when required, your approval.
        </p>
      </PageHeader>
      <div className="mt-8">
        <ConnectorsBoard
          connectors={toPlain(service.list())}
          pending={toPlain(pending)}
          readOnly={role === "viewer"}
          canAdmin={role === "owner" || role === "admin"}
        />
      </div>
    </div>
  );
}
