import type { DatabaseSync } from "node:sqlite";
import { recordInboundMessage } from "./ingest";
import { ConnectorRegistry } from "./registry";
import { redactSecrets } from "./secrets";

export const IMAP_ID = "email-imap";

export type ImapSyncResult =
  | { state: "not_configured"; missing: string[] }
  | { state: "ok"; fetched: number; recorded: number; summary: string }
  | { state: "error"; summary: string };

async function connect(values: Record<string, string>) {
  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow({
    host: values.host,
    port: Number(values.port || 993),
    secure: values.tls ? /^(1|true|yes|on)$/i.test(values.tls) : true,
    auth: { user: values.user, pass: values.password },
    logger: false,
    socketTimeout: 20_000,
  });
  await client.connect();
  return client;
}

export async function testImap(db: DatabaseSync, workspaceId: string): Promise<ImapSyncResult> {
  const registry = ConnectorRegistry.for(db, workspaceId);
  const resolved = registry.resolve(IMAP_ID);
  if (!resolved.configured) return { state: "not_configured", missing: resolved.missing };
  try {
    const client = await connect(resolved.values);
    const status = await client.status(resolved.values.mailbox || "INBOX", { messages: true, unseen: true });
    await client.logout();
    const summary = `Connected. ${status.messages ?? 0} messages, ${status.unseen ?? 0} unseen.`;
    registry.recordRun(IMAP_ID, "test", "ok", summary);
    return { state: "ok", fetched: 0, recorded: 0, summary };
  } catch (error) {
    const summary = redactSecrets(error instanceof Error ? error.message : "IMAP connection failed.", registry.knownSecretValues(IMAP_ID));
    registry.recordRun(IMAP_ID, "test", "error", summary);
    return { state: "error", summary };
  }
}

/** Pull new messages (UID > cursor, at most `limit`) and record each as a message.received event. */
export async function syncImap(db: DatabaseSync, workspaceId: string, limit = 50): Promise<ImapSyncResult> {
  const registry = ConnectorRegistry.for(db, workspaceId);
  const resolved = registry.resolve(IMAP_ID);
  if (!resolved.configured) return { state: "not_configured", missing: resolved.missing };
  if (!registry.isEnabled(IMAP_ID)) return { state: "error", summary: "Enable the connector before syncing." };
  const { simpleParser } = await import("mailparser");
  let fetched = 0;
  let recorded = 0;
  try {
    const client = await connect(resolved.values);
    const lock = await client.getMailboxLock(resolved.values.mailbox || "INBOX");
    try {
      const last = Number(registry.cursor(IMAP_ID) || 0);
      const range = last > 0 ? `${last + 1}:*` : "1:*";
      const uids = ((await client.search({ uid: range }, { uid: true })) || []).filter((uid) => uid > last).slice(-limit);
      let maxUid = last;
      for (const uid of uids) {
        const message = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
        if (!message || !message.source) continue;
        fetched += 1;
        const parsed = await simpleParser(message.source);
        const from = parsed.from?.value?.[0];
        recordInboundMessage(db, {
          source: IMAP_ID,
          sourceId: parsed.messageId || `uid:${uid}`,
          channel: "email",
          from: from?.address || "",
          fromName: from?.name || undefined,
          subject: parsed.subject || "",
          text: parsed.text || "",
          occurredAt: (parsed.date || new Date()).toISOString(),
        });
        recorded += 1;
        maxUid = Math.max(maxUid, uid);
      }
      registry.setCursor(IMAP_ID, String(maxUid));
    } finally {
      lock.release();
      await client.logout().catch(() => undefined);
    }
    const summary = `${recorded} new message(s) recorded as events.`;
    registry.recordRun(IMAP_ID, "sync", "ok", summary, { fetched, recorded });
    return { state: "ok", fetched, recorded, summary };
  } catch (error) {
    const summary = redactSecrets(error instanceof Error ? error.message : "IMAP sync failed.", registry.knownSecretValues(IMAP_ID));
    registry.recordRun(IMAP_ID, "sync", "error", summary);
    return { state: "error", summary };
  }
}
