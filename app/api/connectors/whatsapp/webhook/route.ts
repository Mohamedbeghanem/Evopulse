import { NextResponse } from "next/server";
import { getWorkspace } from "@/lib/auth";
import { ConnectorRegistry } from "@/lib/connectors/registry";
import { ingestWhatsappWebhook, verifySignature, verifyWebhookHandshake, WHATSAPP_ID } from "@/lib/connectors/whatsapp";
import { runWithDb } from "@/lib/db";
import { openWorkspaceDb } from "@/lib/workspace/db";

export const dynamic = "force-dynamic";

function workspaceDb(req: Request) {
  const workspaceId = new URL(req.url).searchParams.get("workspace") || "";
  if (!workspaceId || workspaceId === "ws_demo" || !getWorkspace(workspaceId)) return null;
  return { workspaceId, db: openWorkspaceDb(workspaceId) };
}

/** Meta verification handshake: GET ?workspace=<id>&hub.mode=subscribe&hub.verify_token=…&hub.challenge=… */
export async function GET(req: Request) {
  const target = workspaceDb(req);
  if (!target) return NextResponse.json({ error: "Unknown workspace." }, { status: 404 });
  const config = ConnectorRegistry.for(target.db, target.workspaceId).resolve(WHATSAPP_ID);
  if (!config.configured) return NextResponse.json({ error: "WhatsApp is not configured." }, { status: 503 });
  const challenge = verifyWebhookHandshake(new URL(req.url).searchParams, config.values.verifyToken);
  if (!challenge) return NextResponse.json({ error: "Verification failed." }, { status: 403 });
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/** Inbound messages. Signed with X-Hub-Signature-256; unsigned or unconfigured requests are refused. */
export async function POST(req: Request) {
  const target = workspaceDb(req);
  if (!target) return NextResponse.json({ error: "Unknown workspace." }, { status: 404 });
  const registry = ConnectorRegistry.for(target.db, target.workspaceId);
  const config = registry.resolve(WHATSAPP_ID);
  if (!config.configured) return NextResponse.json({ error: "WhatsApp is not configured." }, { status: 503 });
  if (!registry.isEnabled(WHATSAPP_ID)) return NextResponse.json({ error: "WhatsApp connector is disabled." }, { status: 409 });
  const raw = await req.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), config.values.appSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const events = runWithDb(target.db, () => ingestWhatsappWebhook(target.db, target.workspaceId, payload));
  return NextResponse.json({ received: events.length });
}
