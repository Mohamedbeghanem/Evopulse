import { NextResponse } from "next/server";
import { withConnectors } from "@/lib/connectors/http";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

/** Register an MCP server (admins). Tools are listed on "Test connection". */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return withConnectors("admin", async ({ service, actor }) => {
    const view = service.addMcpServer(body, actor);
    const test = await service.test(view.installId);
    return NextResponse.json({ connector: toPlain(service.registry.view(view.installId)), result: toPlain(test) });
  });
}
