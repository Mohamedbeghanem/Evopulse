"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { ConnectorState, ConnectorView } from "@/lib/connectors/types";
import { ImportPanel } from "./ImportPanel";

type Pending = { id: string; type: string; title: string; policy_outcome: string; policy_reason: string; status: string };

const STATE_LABEL: Record<ConnectorState, string> = {
  connected: "Connected",
  not_configured: "Not configured",
  error: "Error",
  disabled: "Ready · off",
};

const STATE_TONE: Record<ConnectorState, string> = {
  connected: "text-ok border-ok/40",
  not_configured: "text-mute border-hairline",
  error: "text-miss border-miss/40",
  disabled: "text-sand border-hairline",
};

async function call(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string; result?: { ok?: boolean; summary?: string; state?: string } };
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function when(iso: string | null) {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function StatePill({ state }: { state: ConnectorState }) {
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${STATE_TONE[state]}`}>
      {STATE_LABEL[state]}
    </span>
  );
}

function ConfigureForm({ connector, onDone, canAdmin }: { connector: ConnectorView; onDone: (message: string) => void; canAdmin: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!connector.fields.length) return null;
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await call(`/api/connectors/${connector.installId}`, { action: "configure", values });
          setValues({});
          onDone("Saved. Secrets are stored encrypted and never shown again.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Save failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {connector.fields.map((field) => {
        const secretState = connector.secrets[field.key];
        const current = connector.config[field.key];
        const placeholder =
          field.type === "secret"
            ? secretState === "set"
              ? "•••••• stored — leave blank to keep"
              : secretState === "env"
                ? `from ${field.env}`
                : field.placeholder || (field.env ? `or set ${field.env}` : "")
            : current !== undefined
              ? String(current)
              : field.placeholder || (field.env ? `or set ${field.env}` : "");
        return (
          <label key={field.key} className="block text-sm text-sand">
            {field.label}
            {field.required ? <span className="text-need"> *</span> : null}
            <input
              name={field.key}
              type={field.type === "secret" ? "password" : field.type === "number" ? "number" : "text"}
              autoComplete={field.type === "secret" ? "new-password" : "off"}
              disabled={!canAdmin}
              value={values[field.key] ?? ""}
              placeholder={placeholder}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
              className="mt-1 block min-h-[40px] w-full rounded-md border border-hairline bg-ink-800 px-3 text-sm text-paper outline-none placeholder:text-mute focus:border-need disabled:opacity-60"
            />
          </label>
        );
      })}
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="ghost" disabled={busy || !canAdmin}>
          Save configuration
        </Button>
        {!canAdmin ? <span className="text-xs text-mute">Only owners and admins can change credentials.</span> : null}
        {error ? (
          <span role="alert" className="text-xs text-miss">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function ConnectorCard({ connector, readOnly, canAdmin }: { connector: ConnectorView; readOnly: boolean; canAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function act(action: string) {
    setBusy(action);
    setMessage(null);
    try {
      const data = await call(`/api/connectors/${connector.installId}`, { action });
      if (data.result?.summary) setMessage(data.result.summary);
      else if (data.result?.state === "not_configured") setMessage("Not configured.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  const isImport = connector.connectorId === "csv-import";
  return (
    <li className="rounded-lg border border-hairline bg-ink-900/40 p-4" data-connector={connector.connectorId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[40rem]">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-paper">{connector.label}</h3>
            <StatePill state={connector.state} />
            {connector.kinds.map((kind) => (
              <span key={kind} className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute">
                {kind}
              </span>
            ))}
          </div>
          <p className="mt-1 text-sm text-sand">{connector.summary}</p>
          <p className="mt-1 font-mono text-[11px] text-mute">
            Last sync {when(connector.lastSyncAt)} · last test {when(connector.lastTestAt)}
            {connector.writeScopes.length ? ` · writes: ${connector.writeScopes.join(", ")}` : ""}
          </p>
          {connector.state === "not_configured" && connector.missing.length ? (
            <p className="mt-1 text-xs text-mute">Needs: {connector.missing.join(", ")}</p>
          ) : null}
          {connector.lastError ? <p className="mt-1 text-xs text-miss">{connector.lastError}</p> : null}
          {!connector.lastError && connector.lastResult ? <p className="mt-1 text-xs text-sand">{connector.lastResult}</p> : null}
          {message ? (
            <p className="mt-1 text-xs text-paper" role="status">
              {message}
            </p>
          ) : null}
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            {connector.fields.length ? (
              <Button variant="quiet" onClick={() => setOpen((v) => !v)}>
                {open ? "Close" : "Configure"}
              </Button>
            ) : null}
            {isImport ? (
              <Button variant="quiet" onClick={() => setOpen((v) => !v)}>
                {open ? "Close" : "Import file"}
              </Button>
            ) : null}
            <Button variant="quiet" disabled={Boolean(busy) || !connector.configured} onClick={() => void act("test")}>
              Test connection
            </Button>
            {connector.connectorId === "email-imap" && connector.enabled ? (
              <Button variant="quiet" disabled={Boolean(busy)} onClick={() => void act("sync")}>
                Sync now
              </Button>
            ) : null}
            {connector.enabled ? (
              <Button variant="ghost" disabled={Boolean(busy)} onClick={() => void act("disable")}>
                Disable
              </Button>
            ) : (
              <Button variant="ghost" disabled={Boolean(busy) || !connector.configured} onClick={() => void act("enable")}>
                Enable
              </Button>
            )}
            {connector.connectorId === "mcp" && canAdmin ? (
              <Button variant="danger" disabled={Boolean(busy)} onClick={() => void act("remove")}>
                Remove
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {open && !readOnly ? (
        isImport ? (
          <div className="mt-4">
            <ImportPanel onImported={() => router.refresh()} />
          </div>
        ) : (
          <ConfigureForm
            connector={connector}
            canAdmin={canAdmin}
            onDone={(text) => {
              setMessage(text);
              setOpen(false);
              router.refresh();
            }}
          />
        )
      ) : null}
      {connector.tools.length ? (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">Plugin tools · {connector.tools.length}</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {connector.tools.map((tool) => (
              <li key={tool.qualifiedName} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-sand" title={tool.description}>
                  {tool.name}
                </span>
                <span className={`font-mono text-[10px] uppercase ${tool.permission === "READ" ? "text-ok" : "text-need"}`}>
                  {tool.permission === "READ" ? "read" : "write · needs approval"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function AddMcpServer() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3 rounded-lg border border-dashed border-hairline p-4 sm:grid-cols-[1fr_2fr_1.5fr_auto]"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage(null);
        try {
          const data = await call("/api/connectors/mcp", { label, url, authorization });
          setMessage(data.result?.summary || "Registered.");
          setLabel("");
          setUrl("");
          setAuthorization("");
          router.refresh();
        } catch (err) {
          setMessage(err instanceof Error ? err.message : "Could not register.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input aria-label="MCP server name" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name" className="min-h-[40px] rounded-md border border-hairline bg-ink-800 px-3 text-sm text-paper placeholder:text-mute" />
      <input aria-label="MCP server URL" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" className="min-h-[40px] rounded-md border border-hairline bg-ink-800 px-3 text-sm text-paper placeholder:text-mute" />
      <input aria-label="Authorization header" type="password" autoComplete="new-password" value={authorization} onChange={(e) => setAuthorization(e.target.value)} placeholder="Authorization (optional)" className="min-h-[40px] rounded-md border border-hairline bg-ink-800 px-3 text-sm text-paper placeholder:text-mute" />
      <Button type="submit" variant="ghost" disabled={busy}>
        Add MCP server
      </Button>
      {message ? <p className="text-xs text-sand sm:col-span-4">{message}</p> : null}
    </form>
  );
}

function PendingApprovals({ pending }: { pending: Pending[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  if (!pending.length) return null;
  return (
    <section className="mt-8">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Connector actions waiting for you · {pending.length}</h2>
      <ul className="mt-3 space-y-2">
        {pending.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline px-3 py-2">
            <div>
              <p className="text-sm text-paper">{item.title}</p>
              <p className="text-xs text-sand">
                {item.policy_outcome.replaceAll("_", " ")} · {item.policy_reason}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="attention"
                onClick={async () => {
                  try {
                    await call(`/api/connectors/actions/${item.id}`, { decision: "approve" });
                    setMessage("Approved. Policy was rechecked and the call ran. Executed is not handled — verification follows.");
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : "Failed.");
                  }
                  router.refresh();
                }}
              >
                Approve
              </Button>
              <Button
                variant="quiet"
                onClick={async () => {
                  await call(`/api/connectors/actions/${item.id}`, { decision: "reject" }).catch(() => undefined);
                  router.refresh();
                }}
              >
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {message ? <p className="mt-2 text-xs text-sand">{message}</p> : null}
    </section>
  );
}

export function ConnectorsBoard({
  connectors,
  pending,
  readOnly,
  canAdmin,
}: {
  connectors: ConnectorView[];
  pending: Pending[];
  readOnly: boolean;
  canAdmin: boolean;
}) {
  const sources = connectors.filter((c) => c.connectorId !== "mcp" && c.kinds[0] !== "outbound");
  const outbound = connectors.filter((c) => c.kinds[0] === "outbound");
  const plugins = connectors.filter((c) => c.connectorId === "mcp");
  const connected = connectors.filter((c) => c.state === "connected").length;
  return (
    <div>
      <p className="font-mono text-[11px] text-mute">
        {connected} connected · {connectors.filter((c) => c.state === "not_configured").length} not configured ·{" "}
        {connectors.filter((c) => c.state === "error").length} error
      </p>
      <PendingApprovals pending={pending} />
      <section className="mt-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Data sources</h2>
        <ul className="mt-3 space-y-3">
          {sources.map((c) => (
            <ConnectorCard key={c.installId} connector={c} readOnly={readOnly} canAdmin={canAdmin} />
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Outbound channels</h2>
        <p className="mt-1 text-xs text-mute">Nothing is sent without Policy. Customer messages need your approval by default.</p>
        <ul className="mt-3 space-y-3">
          {outbound.map((c) => (
            <ConnectorCard key={c.installId} connector={c} readOnly={readOnly} canAdmin={canAdmin} />
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Plugins · MCP servers</h2>
        <p className="mt-1 text-xs text-mute">
          Tools marked read-only by the server run for the agent. Every other tool is a write: it becomes an action that Policy checks and a human approves.
        </p>
        <ul className="mt-3 space-y-3">
          {plugins.map((c) => (
            <ConnectorCard key={c.installId} connector={c} readOnly={readOnly} canAdmin={canAdmin} />
          ))}
        </ul>
        {!readOnly && canAdmin ? (
          <div className="mt-3">
            <AddMcpServer />
          </div>
        ) : null}
        {!plugins.length ? <p className="mt-3 text-sm text-sand">No MCP servers registered.</p> : null}
      </section>
    </div>
  );
}
