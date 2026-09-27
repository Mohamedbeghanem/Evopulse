"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { CatalogEntry } from "@/lib/connectors/catalog";
import type { ConnectorState, ConnectorView } from "@/lib/connectors/types";
import { AddMcpServerForm } from "./AddMcpServerForm";
import { ImportPanel } from "./ImportPanel";
import { call, ConnectorIcon, PendingApprovals, StatusChip, type PendingAction } from "./ui";

export type CatalogItem = CatalogEntry & { installs: { installId: string; label: string; state: ConnectorState; enabled: boolean }[] };

const CATEGORIES = ["All", "Data", "Email", "Messaging", "Payments", "Productivity", "Engineering", "Plugins"] as const;

export function ConnectorsAdmin({
  catalog,
  connectors,
  pending,
  canAdmin,
  canDecide,
  readOnly,
  notice,
}: {
  catalog: CatalogItem[];
  connectors: ConnectorView[];
  pending: PendingAction[];
  canAdmin: boolean;
  canDecide: boolean;
  readOnly: boolean;
  notice?: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(notice || null);
  const [importOpen, setImportOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter(
      (entry) =>
        (category === "All" || entry.category === category) &&
        (!q || `${entry.name} ${entry.description} ${entry.category}`.toLowerCase().includes(q)),
    );
  }, [catalog, query, category]);

  const counts = connectors.reduce<Record<string, number>>((acc, item) => {
    acc[item.state] = (acc[item.state] || 0) + 1;
    return acc;
  }, {});

  async function install(entry: CatalogItem) {
    if (entry.id === "custom-mcp") {
      setCustomOpen(true);
      return;
    }
    if (entry.id === "csv-import") {
      setImportOpen(true);
      return;
    }
    setBusy(entry.id);
    setMessage(null);
    try {
      const data = await call<{ connector: ConnectorView }>("/api/connectors/catalog/install", { entryId: entry.id });
      const installId = data.connector.installId;
      if (entry.auth === "oauth") {
        const started = await call<{ authorizeUrl: string }>(`/api/connectors/${installId}`, { action: "oauth_start" }).catch((err: Error) => {
          setMessage(`${entry.name}: ${err.message} You can retry from the connector page.`);
          return null;
        });
        if (started?.authorizeUrl) {
          window.location.assign(started.authorizeUrl);
          return;
        }
      }
      router.push(`/connectors/${encodeURIComponent(installId)}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Install failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">
        {counts.connected || 0} connected · {(counts.needs_auth || 0) + (counts.needs_grant || 0)} need auth · {counts.not_configured || 0} not configured ·{" "}
        {counts.error || 0} error
        {!canAdmin && !readOnly ? " · you see what an admin enabled" : ""}
      </p>
      {message ? (
        <p role="status" className="rounded-md border border-hairline px-3 py-2 text-sm text-sand">
          {message}
        </p>
      ) : null}

      {connectors.length ? (
        <section aria-label="Installed connectors">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Installed · {connectors.length}</h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {connectors.map((item) => {
              const entry = catalog.find((c) => (item.connectorId === "mcp" ? c.id === item.catalogId : c.connectorId === item.connectorId)) ||
                catalog.find((c) => c.id === "custom-mcp");
              return (
                <li key={item.installId}>
                  <Link
                    href={`/connectors/${encodeURIComponent(item.installId)}`}
                    className="flex items-center gap-3 rounded-md border border-hairline px-3 py-3 hover:border-white/25"
                  >
                    <ConnectorIcon icon={entry?.icon} monogram={entry?.monogram} accent={entry?.accent} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-paper">{item.label}</span>
                      <span className="block truncate text-xs text-mute">
                        {item.tools.length ? `${item.tools.filter((t) => t.enabled).length}/${item.tools.length} tools` : item.category}
                        {item.transport ? ` · ${item.transport}` : ""}
                      </span>
                    </span>
                    <StatusChip state={item.state} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <PendingApprovals pending={pending} canDecide={canDecide} />

      <section aria-label="Catalog">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Catalog · {filtered.length}</h2>
          <label className="relative block w-full max-w-sm">
            <span className="sr-only">Search connectors</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" aria-hidden strokeWidth={1.75} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search connectors and plugins"
              className="block min-h-[38px] w-full rounded-md border border-hairline bg-ink-800 pl-9 pr-3 text-sm text-paper outline-none placeholder:text-mute focus:border-need"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Categories">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={category === item}
              onClick={() => setCategory(item)}
              className={`rounded-full border px-3 py-1 text-xs ${category === item ? "border-paper text-paper" : "border-hairline text-sand hover:text-paper"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry) => {
            const installed = entry.installs[0];
            const action = entry.auth === "oauth" ? "Connect" : entry.id === "csv-import" ? "Import" : entry.id === "custom-mcp" ? "Add server" : "Install";
            return (
              <li key={entry.id} className="flex flex-col rounded-md border border-hairline p-4">
                <div className="flex items-start gap-3">
                  <ConnectorIcon icon={entry.icon} monogram={entry.monogram} accent={entry.accent} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-paper">
                      {entry.name}
                      {installed ? <StatusChip state={busy === entry.id ? "loading" : installed.state} /> : busy === entry.id ? <StatusChip state="loading" /> : null}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-mute">
                      {entry.category} · {entry.auth === "oauth" ? "OAuth" : entry.auth === "api_key" ? "API key" : entry.auth === "file" ? "File" : entry.auth === "custom" ? "MCP" : "Built in"}
                      {entry.preset ? " · remote MCP" : ""}
                    </p>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-sm text-sand">{entry.description}</p>
                {!entry.verified ? <p className="mt-2 text-[11px] text-mute">Not yet verified against the live provider.</p> : null}
                <div className="mt-3 flex items-center gap-2">
                  {installed ? (
                    <Link href={`/connectors/${encodeURIComponent(installed.installId)}`} className="text-sm text-paper underline">
                      Manage
                    </Link>
                  ) : null}
                  {canAdmin && (!installed || entry.connectorId === "mcp" || entry.id === "csv-import") ? (
                    <Button variant={installed ? "quiet" : "ghost"} disabled={busy !== null} onClick={() => void install(entry)}>
                      {installed && entry.connectorId === "mcp" ? "Add account" : action}
                    </Button>
                  ) : null}
                  {!canAdmin && !installed ? <span className="text-xs text-mute">{readOnly ? "Read-only" : "Ask a workspace admin"}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
        {!filtered.length ? <p className="mt-4 text-sm text-mute">No connector matches “{query}”.</p> : null}
      </section>

      {importOpen && canAdmin ? (
        <section aria-label="Import a file" className="rounded-md border border-hairline p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-paper">CSV / Excel import</h2>
            <button type="button" className="text-xs text-sand underline" onClick={() => setImportOpen(false)}>
              Close
            </button>
          </div>
          <div className="mt-3">
            <ImportPanel onImported={() => router.refresh()} />
          </div>
        </section>
      ) : null}

      {canAdmin ? (
        <section aria-label="Add custom MCP server" id="custom-mcp">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Add custom MCP server</h2>
            <button type="button" className="text-xs text-sand underline" onClick={() => setCustomOpen((v) => !v)}>
              {customOpen ? "Hide" : "Show"}
            </button>
          </div>
          {customOpen ? (
            <div className="mt-3 rounded-md border border-hairline p-4">
              <AddMcpServerForm />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
