import { NextResponse } from "next/server";
import { withConnectors } from "@/lib/connectors/http";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

/** Admins install a catalog entry (built-in or remote MCP preset). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { entryId?: string };
  return withConnectors("admin", async ({ service, actor }) => {
    const view = service.installFromCatalog(String(body.entryId || ""), actor);
    return NextResponse.json({ connector: toPlain(view) });
  });
}
