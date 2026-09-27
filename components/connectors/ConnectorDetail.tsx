"use client";

import { ArrowLeft, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { CatalogEntry } from "@/lib/connectors/catalog";
import type { ConnectorView, PluginToolView } from "@/lib/connectors/types";
import { ImportPanel } from "./ImportPanel";
import { call, ConnectForm, ConnectorIcon, StatusChip, when, type ChipState } from "./ui";

export type ActivityRow = {
  id: string;
  tool: string;
  permission: string;
  policy_outcome: string;
  status: string;
  action_id: string | null;
  actor: string;
  summary: string;
  created_at: string;
};

type RunRow = { id: string; kind: string; status: string; summary: string; created_at: string };

const OUTCOME_TONE: Record<string, string> = {
  ALLOWED: "text-ok",
  EXECUTED: "text-ok",
  APPROVED: "text-ok",
  APPROVAL_REQUIRED: "text-need",
  BLOCKED: "text-miss",
  DENIED: "text-miss",
  FAILED: "text-miss",
  REJECTED: "text-sand",
};

function ToolRow({ tool, canAdmin, onToggle }: { tool: PluginToolView; canAdmin: boolean; onToggle: (enabled: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const destructive = tool.annotations?.destructiveHint === true;
  return (
    <li className="rounded-md border border-hairline">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-[13px] text-paper">{tool.name}</span>
            <span className="block truncate text-xs text-mute">{tool.title || tool.description}</span>
          </span>
          <span
            className={`whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
              tool.permission === "READ" ? "border-ok/40 text-ok" : "border-need/40 text-need"
            }`}
          >
            {tool.permission === "READ" ? "Read" : destructive ? "Write · destructive · approval" : "Write · approval"}
          </span>
          <label className="flex items-center gap-2 text-xs text-sand" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              role="switch"
              aria-label={`${tool.enabled ? "Disable" : "Enable"} ${tool.name}`}
              checked={tool.enabled}
              disabled={!canAdmin || busy}
              onChange={async (e) => {
                setBusy(true);
                await onToggle(e.target.checked).finally(() => setBusy(false));
              }}
              className="h-4 w-4 accent-[var(--color-need,#ff6a3d)]"
            />
            {tool.enabled ? "On" : "Off"}
          </label>
        </summary>
        <div className="space-y-2 border-t border-hairline px-3 py-3">
          <p className="whitespace-pre-wrap text-sm text-sand">{tool.description}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute">
            Agent name {tool.qualifiedName} · annotations {tool.annotations?.readOnlyHint ? "readOnly" : "none/readWrite"}
            {destructive ? " · destructive" : ""}
            {tool.annotations?.idempotentHint ? " · idempotent" : ""}
          </p>
          <pre className="max-h-64 overflow-auto rounded bg-ink-800 p-2 font-mono text-[11px] text-sand">{JSON.stringify(tool.inputSchema, null, 2)}</pre>
          <p className="text-[11px] text-mute">Tool descriptions come from the server and are treated as data, not instructions.</p>
        </div>
      </details>
    </li>
  );
}

export function ConnectorDetail({
  connector,
  catalog,
  activity,
  runs,
  canAdmin,
  stdio,
  notice,
}: {
  connector: ConnectorView;
  catalog: CatalogEntry | null;
  activity: ActivityRow[];
  runs: RunRow[];
  canAdmin: boolean;
  stdio: { allowed: boolean; reason: string } | null;
  notice?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(notice || null);
  const [label, setLabel] = useState(connector.label);
  const [instructions, setInstructions] = useState(connector.instructions);
  const chip: ChipState = busy === "test" || busy === "oauth_start" ? "loading" : connector.state;
  const isMcp = connector.connectorId === "mcp";
  const needsOAuth = isMcp && connector.authType === "oauth";

  async function act(action: string, extra: Record<string, unknown> = {}, success?: string) {
    setBusy(action);
    setMessage(null);
    try {
      const data = await call<{ result?: { ok?: boolean; summary?: string }; authorizeUrl?: string; removed?: string }>(
        `/api/connectors/${connector.installId}`,
        { action, ...extra },
      );
      if (data.authorizeUrl) {
        window.location.assign(data.authorizeUrl);
        return;
      }
      if (data.removed) {
        router.push("/connectors");
        return;
      }
      setMessage(data.result?.summary || success || "Saved.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const reads = connector.tools.filter((t) => t.permission === "READ").length;

  return (
    <div className="space-y-8">
      <Link href="/connectors" className="inline-flex items-center gap-1 text-xs text-sand hover:text-paper">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden strokeWidth={1.75} /> All connectors
      </Link>

      <header className="flex flex-wrap items-start gap-4">
        <ConnectorIcon icon={catalog?.icon} monogram={catalog?.monogram} accent={catalog?.accent} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-3 text-[24px] leading-tight tracking-tight text-paper">
            {connector.label}
            <StatusChip state={chip} />
          </h1>
          <p className="mt-1 text-sm text-sand">{catalog?.description || connector.summary}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-mute">
            {connector.category} · {connector.kinds.join(" + ")}
            {connector.transport ? ` · ${connector.transport}` : ""}
            {connector.serverName ? ` · server ${connector.serverName}` : ""} · last used {when(connector.lastUsedAt)} · last test {when(connector.lastTestAt)}
          </p>
        </div>
        {canAdmin ? (
          <div className="flex flex-wrap gap-2">
            {needsOAuth ? (
              <Button variant={connector.state === "needs_auth" ? "attention" : "quiet"} disabled={busy !== null} onClick={() => void act("oauth_start")}>
                <KeyRound className="mr-1.5 h-4 w-4" aria-hidden strokeWidth={1.75} />
                {connector.authStatus === "authorized" ? "Reconnect" : connector.state === "needs_grant" ? "Grant access" : "Connect with OAuth"}
              </Button>
            ) : null}
            <Button variant="ghost" disabled={busy !== null || !connector.configured} onClick={() => void act("test")}>
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden strokeWidth={1.75} />
              {busy === "test" ? "Testing…" : "Test connection"}
            </Button>
            <Button
              variant="quiet"
              disabled={busy !== null || (!connector.enabled && !connector.configured)}
              onClick={() => void act(connector.enabled ? "disable" : "enable", {}, connector.enabled ? "Disabled." : "Enabled.")}
            >
              {connector.enabled ? "Disable" : "Enable"}
            </Button>
          </div>
        ) : null}
      </header>

      {message ? (
        <p role="status" className="rounded-md border border-hairline px-3 py-2 text-sm text-sand">
          {message}
        </p>
      ) : null}
      {connector.lastError && canAdmin ? (
        <p role="alert" className="rounded-md border border-miss/40 px-3 py-2 text-sm text-miss">
          {connector.lastError}
        </p>
      ) : null}
      {connector.state === "needs_auth" ? (
        <p className="text-sm text-need">
          {needsOAuth
            ? "Sign in with the provider. EvoPulse discovers its authorization server, registers itself when allowed, and uses PKCE. Tokens are stored encrypted."
            : "The server rejected the credentials. Paste a new API key below."}
        </p>
      ) : null}
      {connector.state === "needs_grant" ? <p className="text-sm text-need">Signed in, but the grant does not cover this server&apos;s tools. Grant access again with broader scopes.</p> : null}

      {connector.connectorId === "csv-import" && canAdmin ? (
        <section aria-label="Import a file" className="rounded-md border border-hairline p-4">
          <ImportPanel onImported={() => router.refresh()} />
        </section>
      ) : null}

      {connector.fields.length && canAdmin ? (
        <section aria-label="Connect" className="rounded-md border border-hairline p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Connection</h2>
          {stdio && !stdio.allowed && connector.config.transport === "stdio" ? <p className="mt-1 text-xs text-mute">stdio: {stdio.reason}</p> : null}
          <div className="mt-3">
            <ConnectForm connector={connector} canAdmin={canAdmin} onSaved={(msg) => {
                setMessage(msg);
                router.refresh();
              }} submitLabel="Save connection" />
          </div>
        </section>
      ) : null}

      <section aria-label="Tools">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
          Tools · {connector.tools.length} ({reads} read, {connector.tools.length - reads} need approval)
        </h2>
        {connector.tools.length ? (
          <ul className="mt-3 space-y-2">
            {connector.tools.map((tool) => (
              <ToolRow
                key={tool.name}
                tool={tool}
                canAdmin={canAdmin}
                onToggle={async (enabled) => act("tool", { tool: tool.name, enabled }, `${tool.name} ${enabled ? "enabled" : "disabled"}.`)}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-mute">{isMcp ? "No tools listed yet. Connect, then Test connection." : "This connector has no agent tools; it brings data in or sends approved messages."}</p>
        )}
        {connector.resources.length || connector.prompts.length ? (
          <p className="mt-3 text-xs text-mute">
            Also offers {connector.resources.length} resource(s) and {connector.prompts.length} prompt(s)
            {connector.prompts.length ? `: ${connector.prompts.slice(0, 5).map((p) => p.name).join(", ")}` : ""}.
          </p>
        ) : null}
      </section>

      <section aria-label="Custom instructions">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Custom instructions</h2>
        <p className="mt-1 text-xs text-mute">The agent receives this text with this connector&apos;s tools. It cannot relax Policy or approvals.</p>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          disabled={!canAdmin}
          maxLength={2000}
          rows={3}
          placeholder="e.g. Only look up invoices for the current quarter. Never create credit notes above 5%."
          className="mt-2 block w-full rounded-md border border-hairline bg-ink-800 p-3 text-sm text-paper outline-none placeholder:text-mute focus:border-need disabled:opacity-60"
        />
        {canAdmin ? (
          <div className="mt-2">
            <Button variant="quiet" disabled={busy !== null} onClick={() => void act("instructions", { instructions }, "Instructions saved.")}>
              Save instructions
            </Button>
          </div>
        ) : null}
      </section>

      <section aria-label="Account">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Account</h2>
        <div className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-hairline p-3">
          <label className="block min-w-[14rem] flex-1 text-sm text-sand">
            Display name
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={!canAdmin}
              className="mt-1 block min-h-[38px] w-full rounded-md border border-hairline bg-ink-800 px-3 text-sm text-paper outline-none focus:border-need disabled:opacity-60"
            />
          </label>
          <p className="text-xs text-mute">
            Auth: {connector.authType === "oauth" ? `OAuth (${connector.authStatus.replace("_", " ")})` : connector.authType === "bearer" ? "API key" : connector.authType}
          </p>
          {canAdmin ? (
            <div className="flex gap-2">
              <Button variant="quiet" disabled={busy !== null || label.trim() === connector.label} onClick={() => void act("rename", { label }, "Renamed.")}>
                Rename
              </Button>
              <Button
                variant="danger"
                disabled={busy !== null}
                onClick={() => {
                  if (!window.confirm(isMcp ? `Remove ${connector.label}? Its tools disappear from the agent.` : `Disconnect ${connector.label}? Stored credentials are deleted.`)) return;
                  void act(isMcp ? "remove" : "disconnect", {}, "Disconnected.");
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden strokeWidth={1.75} />
                {isMcp ? "Remove" : "Disconnect"}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-label="Activity">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Activity · tool calls and policy outcome</h2>
        {activity.length ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute">
                <tr>
                  <th className="py-2 pr-3 font-normal">When</th>
                  <th className="py-2 pr-3 font-normal">Tool</th>
                  <th className="py-2 pr-3 font-normal">Policy</th>
                  <th className="py-2 pr-3 font-normal">Status</th>
                  <th className="py-2 pr-3 font-normal">By</th>
                  <th className="py-2 font-normal">Detail</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row) => (
                  <tr key={row.id} className="border-t border-hairline align-top">
                    <td className="py-2 pr-3 text-xs text-mute">{when(row.created_at)}</td>
                    <td className="py-2 pr-3 font-mono text-[12px] text-paper">
                      {row.tool} <span className="text-mute">{row.permission === "READ" ? "R" : "W"}</span>
                    </td>
                    <td className={`py-2 pr-3 font-mono text-[11px] ${OUTCOME_TONE[row.policy_outcome] || "text-sand"}`}>{row.policy_outcome.replaceAll("_", " ")}</td>
                    <td className="py-2 pr-3 text-xs text-sand">{row.status}</td>
                    <td className="py-2 pr-3 text-xs text-sand">{row.actor}</td>
                    <td className="py-2 text-xs text-sand">{row.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-mute">No tool calls yet.</p>
        )}
        {runs.length ? (
          <ul className="mt-4 space-y-1 text-xs text-mute">
            {runs.map((run) => (
              <li key={run.id}>
                {when(run.created_at)} · {run.kind} · <span className={run.status === "ok" ? "text-ok" : "text-miss"}>{run.status}</span> · {run.summary}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
