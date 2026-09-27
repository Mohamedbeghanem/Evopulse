import type { DatabaseSync } from "node:sqlite";
import { getMeta, runWithDb, setMeta } from "../db";
import { commitImport, previewImport, type ImportInput } from "./import";
import { syncImap, testImap } from "./imap";
import { refreshMcpTools } from "./mcp";
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

  addMcpServer(input: Record<string, unknown>, actor: string) {
    const installId = this.registry.ensureInstall("mcp", String(input.label || "MCP server"));
    try {
      return this.registry.configure(installId, input, actor);
    } catch (error) {
      this.registry.remove(installId, actor);
      throw error;
    }
  }
}
