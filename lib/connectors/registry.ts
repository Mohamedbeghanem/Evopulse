import type { DatabaseSync } from "node:sqlite";
import { all, audit, one, run } from "../db";
import { id } from "../ids";
import { CONNECTOR_MANIFESTS, manifestFor } from "./manifests";
import { openSecrets, redactSecrets, sealSecrets } from "./secrets";
import type { AuthStatus, ConfigField, ConnectorManifest, ConnectorState, ConnectorView, PluginToolSpec, PluginToolView } from "./types";

export class ConnectorError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type InstallRow = {
  id: string;
  connector_id: string;
  label: string;
  enabled: number;
  config: string;
  secrets: string;
  tools: string;
  last_sync_at: string | null;
  last_test_at: string | null;
  last_error: string | null;
  last_result: string | null;
  cursor: string;
  created_at: string;
  updated_at: string;
  catalog_id: string;
  instructions: string;
  disabled_tools: string;
  last_used_at: string | null;
  auth: string;
  auth_status: string;
  transport_used: string;
  resources: string;
  prompts: string;
  server_info: string;
};

/** Encrypted OAuth / token state for an install. Never leaves the server. */
export type InstallAuth = {
  clientId?: string;
  clientSecret?: string;
  tokenEndpointAuth?: "none" | "client_secret_post" | "client_secret_basic";
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  tokenEndpoint?: string;
  authorizationEndpoint?: string;
  issuer?: string;
  resource?: string;
  wwwAuthenticate?: string;
};

export function fieldApplies(field: ConfigField, values: Record<string, string>): boolean {
  if (!field.when) return true;
  const current = values[field.when.key] || "";
  if (field.when.in && !field.when.in.includes(current)) return false;
  if (field.when.notIn && field.when.notIn.includes(current)) return false;
  return true;
}

/** Defaults that make older installs (no transport / authType) keep working. */
function applyDefaults(manifest: ConnectorManifest, values: Record<string, string>) {
  if (manifest.id !== "mcp") return values;
  if (!values.transport) values.transport = "auto";
  if (!values.authType) values.authType = values.authorization ? "bearer" : "none";
  return values;
}

export type ResolvedConfig = {
  manifest: ConnectorManifest;
  installId: string;
  values: Record<string, string>;
  configured: boolean;
  missing: string[];
};

/**
 * Env-supplied credentials are process-wide. In a multi-tenant deploy they must not leak into every
 * workspace, so they only apply to workspaces listed in EVOPULSE_CONNECTOR_ENV_WORKSPACES
 * (comma-separated ids, or "*" for a single-tenant deploy).
 */
export function envAllowedFor(workspaceId: string): boolean {
  const raw = (process.env.EVOPULSE_CONNECTOR_ENV_WORKSPACES || "").trim();
  if (!raw) return false;
  if (raw === "*") return true;
  return raw
    .split(",")
    .map((item) => item.trim())
    .includes(workspaceId);
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const value = JSON.parse(raw || "") as T;
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function qualifiedToolName(installId: string, tool: string): string {
  const clean = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `plugin__${clean(installId)}__${clean(tool)}`;
}

export class ConnectorRegistry {
  constructor(
    private readonly db: DatabaseSync,
    private readonly workspaceId: string,
  ) {}

  static for(db: DatabaseSync, workspaceId: string) {
    return new ConnectorRegistry(db, workspaceId);
  }

  catalog(): ConnectorManifest[] {
    return [...CONNECTOR_MANIFESTS];
  }

  private row(installId: string): InstallRow | undefined {
    return one<InstallRow>(this.db, "SELECT * FROM connector_installs WHERE id = ?", [installId]);
  }

  private rows(): InstallRow[] {
    return all<InstallRow>(this.db, "SELECT * FROM connector_installs ORDER BY created_at");
  }

  /** Singletons use their connector id as install id; MCP servers get one install per server. */
  ensureInstall(connectorId: string, label = ""): string {
    const manifest = manifestFor(connectorId);
    if (!manifest) throw new ConnectorError("Unknown connector.", 404);
    const installId = manifest.multiInstance ? id(connectorId) : connectorId;
    if (!manifest.multiInstance && this.row(installId)) return installId;
    const ts = new Date().toISOString();
    run(
      this.db,
      `INSERT INTO connector_installs (id, connector_id, label, enabled, config, secrets, tools, created_at, updated_at)
       VALUES (?, ?, ?, 0, '{}', '', '[]', ?, ?)`,
      [installId, connectorId, label || manifest.name, ts, ts],
    );
    return installId;
  }

  private resolveManifest(installId: string): { manifest: ConnectorManifest; row?: InstallRow } {
    const row = this.row(installId);
    const manifest = manifestFor(row?.connector_id || installId);
    if (!manifest) throw new ConnectorError("Unknown connector.", 404);
    if (manifest.multiInstance && !row) throw new ConnectorError("Connector not installed.", 404);
    return { manifest, row };
  }

  /** Internal only: merged config + decrypted secrets + (allowed) env. Never send this to a client. */
  resolve(installId: string): ResolvedConfig {
    const { manifest, row } = this.resolveManifest(installId);
    const stored = parseJson<Record<string, string | number | boolean>>(row?.config || "{}", {});
    const secrets = openSecrets(row?.secrets || "");
    const useEnv = envAllowedFor(this.workspaceId);
    const raw: Record<string, string> = {};
    for (const field of manifest.config) {
      const fromStore = field.type === "secret" ? secrets[field.key] : stored[field.key];
      const fromEnv = useEnv && field.env ? process.env[field.env] : undefined;
      const value = fromStore !== undefined && fromStore !== "" ? String(fromStore) : fromEnv || "";
      if (value) raw[field.key] = value;
    }
    applyDefaults(manifest, raw);
    const values: Record<string, string> = {};
    for (const field of manifest.config) {
      if (raw[field.key] && fieldApplies(field, raw)) values[field.key] = raw[field.key];
    }
    const missing = manifest.config.filter((field) => field.required && fieldApplies(field, raw) && !values[field.key]).map((field) => field.key);
    return { manifest, installId, values, configured: missing.length === 0, missing };
  }

  getAuth(installId: string): InstallAuth {
    const row = this.row(installId);
    if (!row?.auth) return {};
    const raw = openSecrets(row.auth) as unknown as Record<string, string>;
    return { ...(raw as unknown as InstallAuth), expiresAt: raw.expiresAt ? Number(raw.expiresAt) : undefined };
  }

  setAuth(installId: string, patch: Partial<InstallAuth> | null, status?: AuthStatus) {
    const next = patch === null ? {} : { ...this.getAuth(installId), ...patch };
    const clean = Object.fromEntries(
      Object.entries(next)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => [key, String(value)]),
    ) as Record<string, string>;
    run(this.db, "UPDATE connector_installs SET auth = ?, auth_status = COALESCE(?, auth_status), updated_at = ? WHERE id = ?", [
      Object.keys(clean).length ? sealSecrets(clean) : "",
      status ?? null,
      new Date().toISOString(),
      installId,
    ]);
  }

  setAuthStatus(installId: string, status: AuthStatus) {
    run(this.db, "UPDATE connector_installs SET auth_status = ? WHERE id = ?", [status, installId]);
  }

  setServerDetails(
    installId: string,
    details: { transport?: string; resources?: unknown[]; prompts?: unknown[]; serverInfo?: Record<string, unknown> },
  ) {
    run(
      this.db,
      "UPDATE connector_installs SET transport_used = COALESCE(?, transport_used), resources = COALESCE(?, resources), prompts = COALESCE(?, prompts), server_info = COALESCE(?, server_info) WHERE id = ?",
      [
        details.transport ?? null,
        details.resources ? JSON.stringify(details.resources.slice(0, 100)) : null,
        details.prompts ? JSON.stringify(details.prompts.slice(0, 100)) : null,
        details.serverInfo ? JSON.stringify(details.serverInfo) : null,
        installId,
      ],
    );
  }

  setCatalogId(installId: string, catalogId: string) {
    run(this.db, "UPDATE connector_installs SET catalog_id = ? WHERE id = ?", [catalogId, installId]);
  }

  rename(installId: string, label: string, actor = "operator"): ConnectorView {
    const clean = label.trim().slice(0, 80);
    if (!clean) throw new ConnectorError("Name cannot be empty.");
    const { manifest } = this.resolveManifest(installId);
    if (!this.row(installId)) this.ensureInstall(manifest.id);
    const row = this.row(installId)!;
    const stored = parseJson<Record<string, unknown>>(row.config, {});
    if (manifest.config.some((field) => field.key === "label")) stored.label = clean;
    run(this.db, "UPDATE connector_installs SET label = ?, config = ?, updated_at = ? WHERE id = ?", [
      clean,
      JSON.stringify(stored),
      new Date().toISOString(),
      installId,
    ]);
    audit(this.db, actor, "connector.rename", "connector", installId, {});
    return this.view(installId);
  }

  setInstructions(installId: string, text: string, actor = "operator"): ConnectorView {
    const { manifest } = this.resolveManifest(installId);
    if (!this.row(installId)) this.ensureInstall(manifest.id);
    if (text.length > 2000) throw new ConnectorError("Instructions are limited to 2000 characters.");
    run(this.db, "UPDATE connector_installs SET instructions = ?, updated_at = ? WHERE id = ?", [text.trim(), new Date().toISOString(), installId]);
    audit(this.db, actor, "connector.instructions", "connector", installId, { length: text.trim().length });
    return this.view(installId);
  }

  setToolEnabled(installId: string, tool: string, enabled: boolean, actor = "operator"): ConnectorView {
    const row = this.row(installId);
    if (!row) throw new ConnectorError("Connector not installed.", 404);
    const known = parseJson<PluginToolSpec[]>(row.tools, []).some((item) => item.name === tool);
    if (!known) throw new ConnectorError("Unknown tool.", 404);
    const disabled = new Set(parseJson<string[]>(row.disabled_tools, []));
    if (enabled) disabled.delete(tool);
    else disabled.add(tool);
    run(this.db, "UPDATE connector_installs SET disabled_tools = ?, updated_at = ? WHERE id = ?", [
      JSON.stringify([...disabled]),
      new Date().toISOString(),
      installId,
    ]);
    audit(this.db, actor, enabled ? "connector.tool_enable" : "connector.tool_disable", "connector", installId, { tool });
    return this.view(installId);
  }

  touchUsed(installId: string) {
    run(this.db, "UPDATE connector_installs SET last_used_at = ? WHERE id = ?", [new Date().toISOString(), installId]);
  }

  /** Built-ins: forget credentials, tokens and config, and switch off (the "remove account" of a singleton). */
  disconnect(installId: string, actor = "operator"): ConnectorView {
    const { manifest } = this.resolveManifest(installId);
    if (!this.row(installId)) this.ensureInstall(manifest.id);
    run(
      this.db,
      "UPDATE connector_installs SET enabled = 0, config = '{}', secrets = '', auth = '', auth_status = 'none', last_error = NULL, updated_at = ? WHERE id = ?",
      [new Date().toISOString(), installId],
    );
    audit(this.db, actor, "connector.disconnect", "connector", installId, {});
    return this.view(installId);
  }

  knownSecretValues(installId: string): string[] {
    const resolved = this.resolve(installId);
    const auth = this.getAuth(installId);
    return [
      ...resolved.manifest.config.filter((f) => f.type === "secret").map((f) => resolved.values[f.key]),
      auth.accessToken,
      auth.refreshToken,
      auth.clientSecret,
    ].filter((value): value is string => Boolean(value));
  }

  view(installId: string): ConnectorView {
    const { manifest, row } = this.resolveManifest(installId);
    const resolved = this.resolve(installId);
    const stored = parseJson<Record<string, string | number | boolean>>(row?.config || "{}", {});
    const sealed = openSecrets(row?.secrets || "");
    const useEnv = envAllowedFor(this.workspaceId);
    const secretState: ConnectorView["secrets"] = {};
    const config: ConnectorView["config"] = {};
    for (const field of manifest.config) {
      if (field.type === "secret") {
        secretState[field.key] = sealed[field.key] ? "set" : useEnv && field.env && process.env[field.env] ? "env" : "unset";
      } else if (stored[field.key] !== undefined) {
        config[field.key] = stored[field.key];
      }
    }
    const enabled = Boolean(row?.enabled);
    const lastError = row?.last_error || null;
    const authType = (resolved.values.authType as ConnectorView["authType"]) || (manifest.config.some((f) => f.type === "secret") ? "api_key" : "none");
    const auth = row?.auth ? (openSecrets(row.auth) as unknown as InstallAuth) : {};
    let authStatus = (row?.auth_status || "none") as AuthStatus;
    if (authType === "oauth" && !auth.accessToken && authStatus !== "needs_grant") authStatus = "needs_auth";
    let state: ConnectorState;
    if (!resolved.configured) state = "not_configured";
    else if (authStatus === "needs_auth") state = "needs_auth";
    else if (authStatus === "needs_grant") state = "needs_grant";
    else if (lastError) state = "error";
    else if (enabled) state = "connected";
    else state = "disabled";
    const tools = this.toolsFor(installId, manifest, row);
    const knownSecrets = this.knownSecretValues(installId);
    return {
      installId,
      connectorId: manifest.id,
      name: manifest.name,
      label: row?.label || manifest.name,
      kinds: [...manifest.kinds],
      category: manifest.category,
      summary: manifest.summary,
      capabilities: [...manifest.capabilities],
      readScopes: [...manifest.readScopes],
      writeScopes: [...manifest.writeScopes],
      enabled,
      state,
      configured: resolved.configured,
      missing: resolved.missing,
      config,
      secrets: secretState,
      fields: manifest.config.map((field: ConfigField) => ({ ...field })),
      lastSyncAt: row?.last_sync_at || null,
      lastTestAt: row?.last_test_at || null,
      lastError: lastError ? redactSecrets(lastError, knownSecrets) : null,
      lastResult: row?.last_result ? redactSecrets(row.last_result, knownSecrets) : null,
      tools,
      catalogId: row?.catalog_id || manifest.id,
      authType,
      authStatus,
      instructions: row?.instructions || "",
      disabledTools: parseJson<string[]>(row?.disabled_tools || "[]", []),
      lastUsedAt: row?.last_used_at || null,
      transport: row?.transport_used || resolved.values.transport || "",
      resources: parseJson<{ uri: string; name?: string }[]>(row?.resources || "[]", []).map((item) => ({
        uri: String(item.uri || "").slice(0, 300),
        name: item.name ? String(item.name).slice(0, 120) : undefined,
      })),
      prompts: parseJson<{ name: string; description?: string }[]>(row?.prompts || "[]", []).map((item) => ({
        name: String(item.name || "").slice(0, 120),
        description: item.description ? String(item.description).slice(0, 300) : undefined,
      })),
      serverName: String(parseJson<{ name?: string }>(row?.server_info || "{}", {}).name || "").slice(0, 80),
    };
  }

  list(): ConnectorView[] {
    const views: ConnectorView[] = [];
    for (const manifest of CONNECTOR_MANIFESTS) {
      if (manifest.multiInstance) {
        for (const row of this.rows().filter((item) => item.connector_id === manifest.id)) views.push(this.view(row.id));
      } else {
        views.push(this.view(manifest.id));
      }
    }
    return views;
  }

  configure(installId: string, input: Record<string, unknown>, actor = "operator"): ConnectorView {
    const { manifest } = this.resolveManifest(installId);
    if (!this.row(installId)) this.ensureInstall(manifest.id);
    const row = this.row(installId)!;
    const stored = parseJson<Record<string, string | number | boolean>>(row.config, {});
    const secrets = openSecrets(row.secrets);
    const clear = new Set(Array.isArray(input.__clear) ? (input.__clear as unknown[]).map(String) : []);
    for (const field of manifest.config) {
      const raw = input[field.key];
      if (clear.has(field.key)) {
        if (field.type === "secret") delete secrets[field.key];
        else delete stored[field.key];
        continue;
      }
      if (raw === undefined || raw === null) continue;
      const text = String(raw).trim();
      if (field.type === "secret") {
        // Blank secret input means "keep what is stored". Secrets are write-only from the UI.
        if (text) secrets[field.key] = text;
        continue;
      }
      if (!text) {
        delete stored[field.key];
        continue;
      }
      if (field.type === "number") {
        const n = Number(text);
        if (!Number.isFinite(n)) throw new ConnectorError(`${field.label} must be a number.`);
        stored[field.key] = n;
      } else if (field.type === "select") {
        if (field.options && !field.options.includes(text)) throw new ConnectorError(`${field.label} must be one of: ${field.options.join(", ")}.`);
        stored[field.key] = text;
      } else if (field.type === "boolean") {
        stored[field.key] = /^(1|true|yes|on)$/i.test(text);
      } else if (field.type === "url") {
        let url: URL;
        try {
          url = new URL(text);
        } catch {
          throw new ConnectorError(`${field.label} must be a valid URL.`);
        }
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new ConnectorError(`${field.label} must be http(s).`);
        stored[field.key] = url.toString();
      } else {
        if (text.length > 500) throw new ConnectorError(`${field.label} is too long.`);
        stored[field.key] = text;
      }
    }
    const label = typeof stored.label === "string" && stored.label ? stored.label : row.label;
    run(
      this.db,
      "UPDATE connector_installs SET config = ?, secrets = ?, label = ?, last_error = NULL, updated_at = ? WHERE id = ?",
      [JSON.stringify(stored), sealSecrets(secrets), label, new Date().toISOString(), installId],
    );
    audit(this.db, actor, "connector.configure", "connector", installId, {
      fields: Object.keys(input).filter((key) => key !== "__clear"),
    });
    return this.view(installId);
  }

  setEnabled(installId: string, enabled: boolean, actor = "operator"): ConnectorView {
    const { manifest } = this.resolveManifest(installId);
    if (!this.row(installId)) this.ensureInstall(manifest.id);
    if (enabled && !this.resolve(installId).configured) {
      throw new ConnectorError(`${manifest.name} is not configured.`, 409);
    }
    run(this.db, "UPDATE connector_installs SET enabled = ?, updated_at = ? WHERE id = ?", [
      enabled ? 1 : 0,
      new Date().toISOString(),
      installId,
    ]);
    audit(this.db, actor, enabled ? "connector.enable" : "connector.disable", "connector", installId, {});
    return this.view(installId);
  }

  isEnabled(installId: string): boolean {
    return Boolean(this.row(installId)?.enabled);
  }

  remove(installId: string, actor = "operator") {
    const { manifest } = this.resolveManifest(installId);
    if (!manifest.multiInstance) throw new ConnectorError("Built-in connectors can be disabled, not removed.");
    run(this.db, "DELETE FROM connector_installs WHERE id = ?", [installId]);
    run(this.db, "DELETE FROM connector_oauth_states WHERE install_id = ?", [installId]);
    audit(this.db, actor, "connector.remove", "connector", installId, {});
  }

  recordRun(
    installId: string,
    kind: "test" | "sync" | "import" | "webhook" | "tool",
    status: "ok" | "error",
    summary: string,
    stats: Record<string, unknown> = {},
  ) {
    const { manifest } = this.resolveManifest(installId);
    if (!this.row(installId)) this.ensureInstall(manifest.id);
    const known = this.knownSecretValues(installId);
    const safeSummary = redactSecrets(summary, known).slice(0, 500);
    const ts = new Date().toISOString();
    run(
      this.db,
      `INSERT INTO connector_runs (id, install_id, connector_id, kind, status, summary, stats, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id("crun"), installId, manifest.id, kind, status, safeSummary, JSON.stringify(redactSecrets(stats, known)), ts],
    );
    const column = kind === "test" ? "last_test_at" : "last_sync_at";
    run(
      this.db,
      `UPDATE connector_installs SET ${column} = ?, last_error = ?, last_result = ?, updated_at = ? WHERE id = ?`,
      [ts, status === "error" ? safeSummary : null, safeSummary, ts, installId],
    );
  }

  cursor(installId: string): string {
    return this.row(installId)?.cursor || "";
  }

  setCursor(installId: string, cursor: string) {
    run(this.db, "UPDATE connector_installs SET cursor = ? WHERE id = ?", [cursor, installId]);
  }

  setTools(installId: string, tools: PluginToolSpec[]) {
    run(this.db, "UPDATE connector_installs SET tools = ?, updated_at = ? WHERE id = ?", [
      JSON.stringify(tools),
      new Date().toISOString(),
      installId,
    ]);
  }

  private toolsFor(installId: string, manifest: ConnectorManifest, row?: InstallRow): PluginToolView[] {
    if (!row) return [];
    const specs = parseJson<PluginToolSpec[]>(row.tools, []);
    const disabled = new Set(parseJson<string[]>(row.disabled_tools || "[]", []));
    return specs.map((spec) => ({
      ...spec,
      qualifiedName: qualifiedToolName(installId, spec.name),
      installId,
      connectorId: manifest.id,
      enabled: !disabled.has(spec.name),
    }));
  }

  /** Every plugin tool from enabled installs (OpenManus ToolCollection analogue). */
  enabledTools(): PluginToolView[] {
    return this.rows()
      .filter((row) => row.enabled)
      .flatMap((row) => {
        const manifest = manifestFor(row.connector_id);
        return manifest ? this.toolsFor(row.id, manifest, row).filter((tool) => tool.enabled) : [];
      });
  }

  findTool(qualifiedName: string): PluginToolView | undefined {
    return this.enabledTools().find((tool) => tool.qualifiedName === qualifiedName);
  }

  instructionsFor(installId: string): string {
    return this.row(installId)?.instructions || "";
  }

  recentRuns(installId: string, limit = 5) {
    return all<{ id: string; kind: string; status: string; summary: string; created_at: string }>(
      this.db,
      "SELECT id, kind, status, summary, created_at FROM connector_runs WHERE install_id = ? ORDER BY created_at DESC LIMIT ?",
      [installId, limit],
    );
  }
}
