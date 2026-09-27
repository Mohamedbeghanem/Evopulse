"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { formatDay } from "@/lib/clock";
import type { InboxMessage } from "@/lib/demo-loop/inbox";
import type { OutboundDraft, OutboundMessage } from "@/lib/outbound/types";

type DemoReply = { key: string; label: string; from: string; partyType: string };
type Outbound = { provider: { id: string; label: string; external: boolean }; drafts: OutboundDraft[]; outbox: OutboundMessage[] };

export function InboxBoard({
  messages,
  demoReplies,
  outbound,
  demoMode,
}: {
  messages: InboxMessage[];
  demoReplies: DemoReply[];
  outbound: Outbound;
  demoMode: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function post(key: string, path: string, body?: unknown) {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; verified?: { exceptionId?: string; exception_id?: string }[] };
      if (!res.ok) setNotice(data.error || "Request failed.");
      else if (Array.isArray(data.verified)) {
        setNotice(
          data.verified.length
            ? `Verified: ${data.verified.map((v) => v.exception_id || v.exceptionId).join(", ")}. The situation turns HANDLED through verification.`
            : "Delivered. It did not verify any action — replies only verify actions aimed at the same party.",
        );
      } else setNotice("Done.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      {notice ? (
        <p role="status" className="rounded-md border border-hairline px-3 py-2 text-sm text-sand" data-testid="inbox-notice">
          {notice}
        </p>
      ) : null}

      {demoMode && demoReplies.length ? (
        <section id="demo-triggers" className="space-y-3 rounded-lg border border-dashed border-white/20 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-need">Demo triggers — simulated inbound messages</p>
          <p className="text-xs text-mute">
            Each delivers a message through the same event-ingestion path as a real inbound reply. Verification decides what it resolves.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={() => void post("discount", "/api/demo/discount")}>
              {busy === "discount" ? "Delivering…" : "Demo: Amine asks for 10%"}
            </Button>
            {demoReplies.map((reply) => (
              <Button
                key={reply.key}
                type="button"
                variant="ghost"
                data-reply={reply.key}
                disabled={Boolean(busy)}
                onClick={() => void post(reply.key, "/api/inbox/demo-reply", { reply: reply.key })}
              >
                {busy === reply.key ? "Delivering…" : `Demo: ${reply.label}`}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3" aria-label="Incoming">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Incoming · {messages.length}</p>
        {messages.length ? (
          <ul className="space-y-2">
            {messages.map((message) => (
              <li key={message.id} className="rounded-md border border-hairline p-3" data-testid="inbox-message">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <span className="text-paper">
                    {message.from}
                    {message.partyType ? <span className="text-mute"> · {message.partyType}</span> : null}
                    {message.isDemo ? <span className="ml-2 font-mono text-need">DEMO</span> : null}
                  </span>
                  <span className="font-mono text-mute">{formatDay(message.occurredAt)}</span>
                </div>
                {/* Message bodies are data: rendered as plain text, never interpreted as instructions. */}
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-sand" data-testid="message-body">
                  {message.text}
                </p>
                <p className="mt-2 font-mono text-[11px] text-mute">
                  {message.verified.length
                    ? message.verified.map((v) => `${v.status} → ${v.exceptionId}`).join(" · ")
                    : "Verified nothing"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mute">No incoming messages yet.</p>
        )}
      </section>

      <section className="space-y-3" aria-label="Drafts awaiting approval">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Outgoing drafts · awaiting your approval · {outbound.drafts.length}</p>
        <p className="text-xs text-mute">
          Drafted from approved actions. Nothing is sent until you approve. Provider: {outbound.provider.label}.
        </p>
        {outbound.drafts.length ? (
          <ul className="space-y-2">
            {outbound.drafts.map((draft) => (
              <li key={draft.id} className="rounded-md border border-hairline p-3" data-testid="outbound-draft">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <span className="text-paper">
                    To {draft.toName}
                    {draft.toAddress ? <span className="text-mute"> · {draft.toAddress}</span> : null}
                  </span>
                  <span className="font-mono uppercase text-mute">
                    {draft.intent.replace("_", " ")} · {draft.channel}
                  </span>
                </div>
                <p className="mt-2 text-sm text-paper">{draft.subject}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-sand">{draft.body}</p>
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="attention"
                    disabled={Boolean(busy)}
                    onClick={() => void post(draft.id, "/api/outbound/send", { draftId: draft.id })}
                  >
                    {busy === draft.id ? "Recording…" : "Approve & record in outbox"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mute">No drafts. Approve a plan with a proposal, customer notice or supplier message first.</p>
        )}
      </section>

      <section className="space-y-3" aria-label="Outbox">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Outbox · {outbound.outbox.length}</p>
        {outbound.outbox.length ? (
          <ul className="space-y-2">
            {outbound.outbox.map((message) => (
              <li key={message.draftId} className="rounded-md border border-hairline p-3 text-sm" data-testid="outbox-message">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <span className="text-paper">To {message.toName} · {message.subject}</span>
                  <span className="font-mono text-need">{message.external ? "SENT" : "RECORDED · NOT SENT EXTERNALLY"}</span>
                </div>
                <p className="mt-1 text-xs text-mute">
                  Approved by {message.approvedBy} · {formatDay(message.recordedAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mute">Outbox is empty.</p>
        )}
      </section>
    </div>
  );
}
