import type { DatabaseSync } from "node:sqlite";
import { getMeta, runWithDb, setMeta } from "../db";
import { commitImport, previewImport, type ImportInput } from "./import";
import { syncImap, testImap } from "./imap";
import { toolCallLog } from "./activity";
import { CATALOG, catalogEntry, catalogFor } from "./catalog";
import { completeMcpOAuth, refreshMcpTools, startMcpOAuth, stdioPolicy, validateMcpConfig } from "./mcp";
import { visibleConnector, visibleConnectors } from "./permissions";
import { ConnectorError, ConnectorRegistry } from "./registry";
import { whatsappConfig } from "./whatsapp";

/** Route-facing facade. Every method is scoped to one workspace DB. */
export class ConnectorService {
  readonly registry: ConnectorRegistry;

  constructor(
    readonly db: DatabaseSync,
    readonly workspaceId: string,
  ) {
    this.registry = ConnectorRegistry.for(db, workspaceId);
    if (workspaceId && getMeta(db, "workspace_id", "") !== workspaceId) setMeta(db, "workspace_id", workspaceId);
  }

  static for(db: DatabaseSync, workspaceId: string) {
    return new ConnectorService(db, workspaceId);
  }

  list() {
    return this.registry.list();
  }

  now() {
    return getMeta(this.db, "demo_now") || new Date().toISOString();
  }

  async test(installId: string) {
    const view = this.registry.view(installId);
    if (view.connectorId === "mcp") return refreshMcpTools(this.db, this.workspaceId, installId);
    if (view.connectorId === "email-imap") {
      const out = await testImap(this.db, this.workspaceId);
      return { ok: out.state === "ok", summary: out.state === "not_configured" ? "Not configured." : out.summary };
    }
    if (view.connectorId === "whatsapp-cloud") {
      const config = whatsappConfig(this.db, this.workspaceId);
      if (!config.configured) return { ok: false, summary: "Not configured." };
      const summary = "Credentials present. Webhook signature checks are enforced with the app secret.";
      this.registry.recordRun(installId, "test", "ok", summary);
      return { ok: true, summary };
    }
    const summary = `${view.name} is built in and ready.`;
    this.registry.recordRun(installId, "test", "ok", summary);
    return { ok: true, summary };
  }

  async sync(installId: string) {
    const view = this.registry.view(installId);
    if (view.connectorId === "email-imap") return syncImap(this.db, this.workspaceId);
    throw new ConnectorError("This connector does not sync on demand.");
  }

  previewImport(input: ImportInput) {
    return previewImport(input);
  }

  async commitImport(input: ImportInput & { skipInvalid?: boolean }, actor: string) {
    const result = await runWithDb(this.db, () => commitImport(this.db, input, this.now(), actor));
    this.registry.ensureInstall("csv-import");
    if (!this.registry.isEnabled("csv-import")) this.registry.setEnabled("csv-import", true, actor);
    this.registry.recordRun(
      "csv-import",
      "import",
      "ok",
      `${result.imported} ${result.type} row(s) imported from ${input.fileName}${result.skipped ? `, ${result.skipped} skipped` : ""}.`,
      { ...result, errors: result.errors.length },
    );
    return result;
  }

  addMcpServer(input: Record<string, unknown>, actor: string, catalogId = "custom-mcp") {
    try {
      validateMcpConfig(input);
    } catch (error) {
      throw new ConnectorError(error instanceof Error ? error.message : "Invalid MCP server.", 400);
    }
    const installId = this.registry.ensureInstall("mcp", String(input.label || "MCP server"));
    try {
      this.registry.configure(installId, input, actor);
      this.registry.setCatalogId(installId, catalogId);
      return this.registry.view(installId);
    } catch (error) {
      this.registry.remove(installId, actor);
      throw error;
    }
  }

  /** Install from the admin catalog. Built-ins return their singleton; presets create an MCP install. */
  installFromCatalog(entryId: string, actor: string) {
    const entry = catalogEntry(entryId);
    if (!entry) throw new ConnectorError("Unknown catalog entry.", 404);
    if (entry.connectorId !== "mcp") {
      const installId = this.registry.ensureInstall(entry.connectorId);
      return this.registry.view(installId);
    }
    if (!entry.preset) throw new ConnectorError("Use the custom MCP server form.", 400);
    return this.addMcpServer(
      { label: entry.name, url: entry.preset.url, transport: entry.preset.transport, authType: entry.preset.authType },
      actor,
      entry.id,
    );
  }

  catalog(role: string | null | undefined) {
    const installs = this.registry.list();
    return CATALOG.map((entry) => {
      const matches = installs.filter((view) => (entry.connectorId === "mcp" ? view.catalogId === entry.id : view.connectorId === entry.connectorId));
      const visible = visibleConnectors(matches, role);
      return {
        ...entry,
        installs: visible.map((view) => ({ installId: view.installId, label: view.label, state: view.state, enabled: view.enabled })),
      };
    });
  }

  detail(installId: string, role: string | null | undefined) {
    const view = this.registry.view(installId);
    const visible = visibleConnector(view, role);
    return {
      connector: visible,
      catalog: catalogFor(view.connectorId, view.catalogId) || null,
      activity: toolCallLog(this.db, installId, 50),
      runs: this.registry.recentRuns(installId, 10),
      stdio: view.connectorId === "mcp" ? { allowed: stdioPolicy().allowed, reason: stdioPolicy().reason } : null,
    };
  }

  startOAuth(installId: string, redirectUri: string) {
    return startMcpOAuth(this.db, this.workspaceId, installId, redirectUri);
  }

  completeOAuth(state: string, code: string) {
    return completeMcpOAuth(this.db, this.workspaceId, state, code);
  }
}
