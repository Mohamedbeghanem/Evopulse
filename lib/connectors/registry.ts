import type { DatabaseSync } from "node:sqlite";
import { all, audit, one, run } from "../db";
import { id } from "../ids";
import { CONNECTOR_MANIFESTS, manifestFor } from "./manifests";
import { openSecrets, redactSecrets, sealSecrets } from "./secrets";
import type { ConfigField, ConnectorManifest, ConnectorState, ConnectorView, PluginToolSpec, PluginToolView } from "./types";

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
};

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
    const values: Record<string, string> = {};
    for (const field of manifest.config) {
      const fromStore = field.type === "secret" ? secrets[field.key] : stored[field.key];
      const fromEnv = useEnv && field.env ? process.env[field.env] : undefined;
      const value = fromStore !== undefined && fromStore !== "" ? String(fromStore) : fromEnv || "";
      if (value) values[field.key] = value;
    }
    const missing = manifest.config.filter((field) => field.required && !values[field.key]).map((field) => field.key);
    return { manifest, installId, values, configured: missing.length === 0, missing };
  }

  knownSecretValues(installId: string): string[] {
    const resolved = this.resolve(installId);
    return resolved.manifest.config.filter((f) => f.type === "secret").map((f) => resolved.values[f.key]).filter(Boolean);
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
    let state: ConnectorState;
    if (!resolved.configured) state = "not_configured";
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
    return specs.map((spec) => ({
      ...spec,
      qualifiedName: qualifiedToolName(installId, spec.name),
      installId,
      connectorId: manifest.id,
    }));
  }

  /** Every plugin tool from enabled installs (OpenManus ToolCollection analogue). */
  enabledTools(): PluginToolView[] {
    return this.rows()
      .filter((row) => row.enabled)
      .flatMap((row) => {
        const manifest = manifestFor(row.connector_id);
        return manifest ? this.toolsFor(row.id, manifest, row) : [];
      });
  }

  findTool(qualifiedName: string): PluginToolView | undefined {
    return this.enabledTools().find((tool) => tool.qualifiedName === qualifiedName);
  }

  recentRuns(installId: string, limit = 5) {
    return all<{ id: string; kind: string; status: string; summary: string; created_at: string }>(
      this.db,
      "SELECT id, kind, status, summary, created_at FROM connector_runs WHERE install_id = ? ORDER BY created_at DESC LIMIT ?",
      [installId, limit],
    );
  }
}
