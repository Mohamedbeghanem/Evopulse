import { createHmac, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { boundedText } from "./data";
import { recordInboundMessage } from "./ingest";
import type { OutboundAdapter } from "./outbound";
import { ConnectorRegistry } from "./registry";

export const WHATSAPP_ID = "whatsapp-cloud";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function whatsappConfig(db: DatabaseSync, workspaceId: string) {
  return ConnectorRegistry.for(db, workspaceId).resolve(WHATSAPP_ID);
}

/** GET hub.challenge handshake. Returns the challenge only for a matching verify token. */
export function verifyWebhookHandshake(params: URLSearchParams, expectedToken: string | undefined): string | null {
  if (!expectedToken) return null;
  if (params.get("hub.mode") !== "subscribe") return null;
  const token = params.get("hub.verify_token") || "";
  if (!safeEqual(token, expectedToken)) return null;
  return params.get("hub.challenge");
}

/** X-Hub-Signature-256 = sha256=HMAC(appSecret, rawBody). No app secret → reject (fail closed). */
export function verifySignature(rawBody: string, header: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  return safeEqual(header, expected);
}

type WaPayload = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: { id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string } }[];
      };
    }[];
  }[];
};

export function parseInbound(payload: unknown) {
  const out: { id: string; from: string; name?: string; text: string; occurredAt: string; phoneNumberId?: string }[] = [];
  for (const entry of (payload as WaPayload)?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const names = new Map((value.contacts || []).map((c) => [c.wa_id || "", c.profile?.name || ""]));
      for (const msg of value.messages || []) {
        if (!msg.id || !msg.from) continue;
        const text = msg.type === "text" ? msg.text?.body || "" : `[${msg.type || "unknown"} message]`;
        const ts = Number(msg.timestamp);
        out.push({
          id: msg.id,
          from: msg.from,
          name: names.get(msg.from) || undefined,
          text,
          occurredAt: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
          phoneNumberId: value.metadata?.phone_number_id,
        });
      }
    }
  }
  return out;
}

export function ingestWhatsappWebhook(db: DatabaseSync, workspaceId: string, payload: unknown) {
  const registry = ConnectorRegistry.for(db, workspaceId);
  const config = registry.resolve(WHATSAPP_ID);
  const messages = parseInbound(payload).filter(
    (msg) => !msg.phoneNumberId || !config.values.phoneNumberId || msg.phoneNumberId === config.values.phoneNumberId,
  );
  const events = messages.map((msg) =>
    recordInboundMessage(db, {
      source: WHATSAPP_ID,
      sourceId: msg.id,
      channel: "whatsapp",
      from: msg.from,
      fromName: msg.name,
      text: msg.text,
      occurredAt: msg.occurredAt,
    }),
  );
  registry.recordRun(WHATSAPP_ID, "webhook", "ok", `${events.length} WhatsApp message(s) recorded as events.`, { count: events.length });
  return events;
}

export const whatsappAdapter: OutboundAdapter = {
  id: WHATSAPP_ID,
  channel: "whatsapp",
  label: "WhatsApp Business",
  isConfigured(ctx) {
    return whatsappConfig(ctx.db, ctx.workspaceId).configured;
  },
  async send(ctx, message) {
    const config = whatsappConfig(ctx.db, ctx.workspaceId);
    if (!config.configured) return { ok: false, detail: "WhatsApp is not configured." };
    const to = message.to.replace(/[^\d]/g, "");
    if (!to) return { ok: false, detail: "Recipient phone number is missing." };
    const base = process.env.WHATSAPP_GRAPH_BASE || "https://graph.facebook.com";
    const version = config.values.apiVersion || "v21.0";
    const res = await fetch(`${base}/${encodeURIComponent(version)}/${encodeURIComponent(config.values.phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.values.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: boundedText(message.body, 4000) } }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { message?: string } };
    if (!res.ok) return { ok: false, detail: `WhatsApp API error ${res.status}: ${boundedText(data.error?.message || "", 200)}` };
    return { ok: true, detail: "Sent via WhatsApp Cloud API.", providerRef: data.messages?.[0]?.id };
  },
};
