import { NextResponse } from "next/server";
import { publicOrigin, withConnectors } from "@/lib/connectors/http";
import { connectorActionLevel } from "@/lib/connectors/permissions";
import { ConnectorError } from "@/lib/connectors/registry";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

type Body = { action?: string; values?: Record<string, unknown>; label?: string; instructions?: string; tool?: string; enabled?: boolean };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withConnectors("read", ({ service, role }) => {
    const detail = service.detail(id, role);
    if (!detail.connector.enabled && role !== "owner" && role !== "admin") throw new ConnectorError("Connector not enabled.", 404);
    return NextResponse.json(toPlain(detail));
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;
  const action = body.action || "";
  return withConnectors(connectorActionLevel(action), async ({ service, actor }) => {
    const registry = service.registry;
    switch (action) {
      case "configure":
        return NextResponse.json({ connector: toPlain(registry.configure(id, body.values || {}, actor)) });
      case "enable":
        return NextResponse.json({ connector: toPlain(registry.setEnabled(id, true, actor)) });
      case "disable":
        return NextResponse.json({ connector: toPlain(registry.setEnabled(id, false, actor)) });
      case "rename":
        return NextResponse.json({ connector: toPlain(registry.rename(id, String(body.label || ""), actor)) });
      case "instructions":
        return NextResponse.json({ connector: toPlain(registry.setInstructions(id, String(body.instructions || ""), actor)) });
      case "tool":
        return NextResponse.json({ connector: toPlain(registry.setToolEnabled(id, String(body.tool || ""), body.enabled !== false, actor)) });
      case "disconnect":
        return NextResponse.json({ connector: toPlain(registry.disconnect(id, actor)) });
      case "test": {
        const result = await service.test(id);
        return NextResponse.json({ result: toPlain(result), connector: toPlain(registry.view(id)) });
      }
      case "sync": {
        const result = await service.sync(id);
        return NextResponse.json({ result: toPlain(result), connector: toPlain(registry.view(id)) });
      }
      case "oauth_start": {
        const redirectUri = `${publicOrigin(req)}/api/connectors/oauth/callback`;
        const { authorizeUrl } = await service.startOAuth(id, redirectUri);
        return NextResponse.json({ authorizeUrl });
      }
      case "remove":
        registry.remove(id, actor);
        return NextResponse.json({ removed: id });
      default:
        throw new ConnectorError("Unknown connector action.");
    }
  });
}
