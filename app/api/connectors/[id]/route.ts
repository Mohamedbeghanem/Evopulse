import { NextResponse } from "next/server";
import { withConnectors } from "@/lib/connectors/http";
import { ConnectorError } from "@/lib/connectors/registry";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

type Body = { action?: string; values?: Record<string, unknown> };

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;
  const action = body.action || "";
  const level = action === "configure" || action === "remove" ? "admin" : "write";
  return withConnectors(level, async ({ service, actor }) => {
    switch (action) {
      case "configure":
        return NextResponse.json({ connector: toPlain(service.registry.configure(id, body.values || {}, actor)) });
      case "enable":
        return NextResponse.json({ connector: toPlain(service.registry.setEnabled(id, true, actor)) });
      case "disable":
        return NextResponse.json({ connector: toPlain(service.registry.setEnabled(id, false, actor)) });
      case "test": {
        const result = await service.test(id);
        return NextResponse.json({ result: toPlain(result), connector: toPlain(service.registry.view(id)) });
      }
      case "sync": {
        const result = await service.sync(id);
        return NextResponse.json({ result: toPlain(result), connector: toPlain(service.registry.view(id)) });
      }
      case "remove":
        service.registry.remove(id, actor);
        return NextResponse.json({ removed: id });
      default:
        throw new ConnectorError("Unknown connector action.");
    }
  });
}
