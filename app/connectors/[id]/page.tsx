import { notFound, redirect } from "next/navigation";
import { ConnectorDetail } from "@/components/connectors/ConnectorDetail";
import { resolveRequestContext } from "@/lib/auth";
import { canManageConnectors } from "@/lib/connectors/permissions";
import { ConnectorError } from "@/lib/connectors/registry";
import { ConnectorService } from "@/lib/connectors/service";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

const NOTICE: Record<string, string> = {
  connected: "Connected. Tools were listed; read-only tools are available to the agent, writes need approval.",
  error: "Signed in, but listing tools failed. See the error below and Test connection again.",
};

export default async function ConnectorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await resolveRequestContext();
  if (!(ctx.mode === "user" && ctx.user && ctx.workspace)) redirect("/connectors");
  const service = ConnectorService.for(ctx.db, ctx.workspace!.id);
  const canAdmin = canManageConnectors(ctx.role);
  let detail: ReturnType<ConnectorService["detail"]>;
  try {
    detail = service.detail(decodeURIComponent(id), ctx.role);
  } catch (error) {
    if (error instanceof ConnectorError) notFound();
    throw error;
  }
  if (!canAdmin && !detail.connector.enabled) notFound();
  const oauth = typeof query.oauth === "string" ? query.oauth : "";
  return (
    <div className="px-4 py-8 lg:px-8">
      <ConnectorDetail
        connector={toPlain(detail.connector)}
        catalog={toPlain(detail.catalog)}
        activity={toPlain(detail.activity)}
        runs={canAdmin ? toPlain(detail.runs) : []}
        canAdmin={canAdmin}
        stdio={detail.stdio}
        notice={NOTICE[oauth] || null}
      />
    </div>
  );
}
