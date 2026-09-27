"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { ConnectorView } from "@/lib/connectors/types";
import { call } from "./ui";

const inputClass =
  "mt-1 block min-h-[40px] w-full rounded-md border border-hairline bg-ink-800 px-3 text-sm text-paper outline-none placeholder:text-mute focus:border-need";

/** URL + transport + auth type. Tokens are masked and never echoed; OAuth goes through discovery + PKCE. */
export function AddMcpServerForm() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [transport, setTransport] = useState("auto");
  const [url, setUrl] = useState("");
  const [authType, setAuthType] = useState("none");
  const [token, setToken] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stdio = transport === "stdio";

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      aria-label="Custom MCP server"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage(null);
        try {
          const body: Record<string, string> = { label, transport, authType: stdio ? "none" : authType };
          if (stdio) {
            body.command = command;
            body.args = args;
          } else {
            body.url = url;
            if (authType === "bearer") body.authorization = token;
          }
          const data = await call<{ connector: ConnectorView; result?: { summary?: string } }>("/api/connectors/mcp", body);
          setToken("");
          if (!stdio && authType === "oauth") {
            const started = await call<{ authorizeUrl: string }>(`/api/connectors/${data.connector.installId}`, { action: "oauth_start" }).catch(
              (err: Error) => {
                setMessage(err.message);
                return null;
              },
            );
            if (started?.authorizeUrl) {
              window.location.assign(started.authorizeUrl);
              return;
            }
          }
          router.push(`/connectors/${encodeURIComponent(data.connector.installId)}`);
        } catch (err) {
          setMessage(err instanceof Error ? err.message : "Could not add the server.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm text-sand">
        Name<span className="text-need"> *</span>
        <input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Accounting MCP" className={inputClass} />
      </label>
      <label className="block text-sm text-sand">
        Transport
        <select value={transport} onChange={(e) => setTransport(e.target.value)} className={inputClass}>
          <option value="auto">Auto (Streamable HTTP, SSE fallback)</option>
          <option value="streamable-http">Streamable HTTP</option>
          <option value="sse">SSE (legacy)</option>
          <option value="stdio">stdio (local, allowlisted)</option>
        </select>
      </label>
      {stdio ? (
        <>
          <label className="block text-sm text-sand">
            Command<span className="text-need"> *</span>
            <input required value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" className={inputClass} />
          </label>
          <label className="block text-sm text-sand">
            Arguments
            <input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-everything" className={inputClass} />
          </label>
          <p className="text-xs text-mute sm:col-span-2">
            stdio runs a local process. It is admin-only, limited to EVOPULSE_MCP_STDIO_ALLOWLIST, and disabled on serverless deploys.
          </p>
        </>
      ) : (
        <>
          <label className="block text-sm text-sand">
            Server URL<span className="text-need"> *</span>
            <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" className={inputClass} />
          </label>
          <label className="block text-sm text-sand">
            Authentication
            <select value={authType} onChange={(e) => setAuthType(e.target.value)} className={inputClass}>
              <option value="none">None</option>
              <option value="bearer">API key / bearer token</option>
              <option value="oauth">OAuth 2.1 (discovery + PKCE)</option>
            </select>
          </label>
          {authType === "bearer" ? (
            <label className="block text-sm text-sand sm:col-span-2">
              API key / bearer token
              <input
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Stored encrypted; never shown again"
                className={inputClass}
              />
            </label>
          ) : null}
        </>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="ghost" disabled={busy}>
          {busy ? "Connecting…" : authType === "oauth" && !stdio ? "Add and sign in" : "Add and test"}
        </Button>
        <span className="text-xs text-mute">Read-only tools run for the agent. Every other tool needs your approval.</span>
        {message ? (
          <span role="alert" className="text-xs text-miss">
            {message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
