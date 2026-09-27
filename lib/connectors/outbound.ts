import type { DatabaseSync } from "node:sqlite";
import { run } from "../db";
import { id } from "../ids";
import { boundedText } from "./data";
import { ConnectorRegistry } from "./registry";

/**
 * Outbound adapter interface. Adapters only SEND; they are invoked by governance.executeConnectorAction
 * after Policy + (when required) human approval + a live policy recheck. They never decide HANDLED.
 * Other modules (e.g. a future lib/outbound drafts pipeline) can call registerOutboundAdapter().
 */
export type OutboundContext = { db: DatabaseSync; workspaceId: string };
export type OutboundMessage = { actionId: string; channel: string; to: string; body: string };
export type OutboundResult = { ok: boolean; detail: string; providerRef?: string };

export interface OutboundAdapter {
  id: string;
  channel: string;
  label: string;
  isConfigured(ctx: OutboundContext): boolean;
  send(ctx: OutboundContext, message: OutboundMessage): Promise<OutboundResult>;
}

const globalForOutbound = globalThis as unknown as { evopulseOutboundAdapters?: Map<string, OutboundAdapter> };

function adapters(): Map<string, OutboundAdapter> {
  return (globalForOutbound.evopulseOutboundAdapters ??= new Map());
}

export function registerOutboundAdapter(adapter: OutboundAdapter) {
  adapters().set(adapter.id, adapter);
}

export function getOutboundAdapter(adapterId: string): OutboundAdapter | undefined {
  ensureBuiltinAdapters();
  return adapters().get(adapterId);
}

export function listOutboundAdapters(): OutboundAdapter[] {
  ensureBuiltinAdapters();
  return [...adapters().values()];
}

export const localOutboxAdapter: OutboundAdapter = {
  id: "local-outbox",
  channel: "local",
  label: "Local outbox",
  isConfigured: () => true,
  async send(ctx, message) {
    const rowId = id("obx");
    run(
      ctx.db,
      `INSERT INTO connector_outbox (id, action_id, channel, recipient, body, status, provider_ref, created_at)
       VALUES (?, ?, ?, ?, ?, 'stored_locally', NULL, ?)`,
      [rowId, message.actionId, message.channel, boundedText(message.to, 200), boundedText(message.body, 4000), new Date().toISOString()],
    );
    return { ok: true, detail: `Stored in local outbox (${rowId}). Nothing left EvoPulse.`, providerRef: rowId };
  },
};

let builtins = false;
function ensureBuiltinAdapters() {
  if (builtins) return;
  builtins = true;
  if (!adapters().has(localOutboxAdapter.id)) adapters().set(localOutboxAdapter.id, localOutboxAdapter);
  // WhatsApp is registered lazily to avoid a module cycle.
  const { whatsappAdapter } = require("./whatsapp") as typeof import("./whatsapp");
  if (!adapters().has(whatsappAdapter.id)) adapters().set(whatsappAdapter.id, whatsappAdapter);
}

export function outboundConfigured(ctx: OutboundContext, adapterId: string): boolean {
  const adapter = getOutboundAdapter(adapterId);
  if (!adapter) return false;
  if (adapterId === "local-outbox") return true;
  return adapter.isConfigured(ctx) && ConnectorRegistry.for(ctx.db, ctx.workspaceId).isEnabled(adapterId);
}
