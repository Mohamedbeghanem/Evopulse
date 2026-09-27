import { NextResponse } from "next/server";
import { assertCanAdmin, assertCanWrite, authErrorResponse, requireUserContext, type WorkspaceRole } from "../auth";
import { runWithDb } from "../db";
import { ConnectorError } from "./registry";
import { ConnectorService } from "./service";

export type ConnectorRouteContext = {
  service: ConnectorService;
  actor: string;
  role: WorkspaceRole;
};

/**
 * Connector routes are user-workspace only. The Atlas demo database is never written by a connector.
 * `level` = write (members+) or admin (owners/admins: credentials, MCP servers).
 */
export async function withConnectors(
  level: "read" | "write" | "admin",
  handler: (ctx: ConnectorRouteContext) => Promise<Response> | Response,
  req?: Request,
): Promise<Response> {
  try {
    const ctx = await requireUserContext(req);
    const role = (ctx.role === "operator" ? "viewer" : ctx.role) as WorkspaceRole;
    if (level === "write") assertCanWrite(role);
    if (level === "admin") assertCanAdmin(role);
    const service = ConnectorService.for(ctx.db, ctx.workspace!.id);
    return await runWithDb(ctx.db, () => handler({ service, actor: ctx.user?.name || ctx.user?.email || "operator", role }));
  } catch (error) {
    if (error instanceof ConnectorError) return NextResponse.json({ error: error.message }, { status: error.status });
    try {
      return authErrorResponse(error);
    } catch {
      const message = error instanceof Error ? error.message : "Connector request failed.";
      return NextResponse.json({ error: message.slice(0, 300) }, { status: 400 });
    }
  }
}

export async function readUpload(req: Request): Promise<{ fileName: string; bytes: Buffer; type?: string; skipInvalid?: boolean }> {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") throw new ConnectorError("Choose a .csv or .xlsx file.");
  const blob = file as File;
  if (blob.size > 5 * 1024 * 1024) throw new ConnectorError("File is larger than 5 MB.");
  const type = form.get("type");
  return {
    fileName: blob.name || "upload.csv",
    bytes: Buffer.from(await blob.arrayBuffer()),
    type: typeof type === "string" && type ? type : undefined,
    skipInvalid: form.get("skipInvalid") === "true",
  };
}

/** Origin for OAuth redirect URIs. EVOPULSE_PUBLIC_URL wins (behind proxies); else forwarded headers; else request URL. */
export function publicOrigin(req: Request): string {
  const configured = (process.env.EVOPULSE_PUBLIC_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const clean = host.replace(/^0\.0\.0\.0(?=:|$)/, "localhost");
  return `${proto}://${clean}`;
}
