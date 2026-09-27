import type { DatabaseSync } from "node:sqlite";
import { id } from "../ids";
import { ConnectorRegistry } from "../connectors/registry";
import type { ConnectorView as RegistryConnectorView } from "../connectors/types";
import { getControlDb } from "../auth/control-db";
import { CONNECTOR_CATALOG, type ConnectorStatus } from "./catalog";

export type ConnectorView = {
  id: string;
  name: string;
  category: string;
  summary: string;
  status: ConnectorStatus;
  connected: boolean;
};

export const IntegrationService = {
  list(workspaceId: string): ConnectorView[] {
    const links = getControlDb()
      .prepare("SELECT connector_id, status FROM connector_links WHERE workspace_id = ?")
      .all(workspaceId) as { connector_id: string; status: ConnectorStatus }[];
    const byId = new Map(links.map((row) => [row.connector_id, row.status]));
    return CONNECTOR_CATALOG.map((connector) => {
      const stored = byId.get(connector.id);
      const status: ConnectorStatus = connector.backend ? stored || "AVAILABLE" : "COMING_SOON";
      return {
        id: connector.id,
        name: connector.name,
        category: connector.category,
        summary: connector.summary,
        status,
        connected: status === "CONNECTED" || status === "SYNCING",
      };
    });
  },

  connect(workspaceId: string, connectorId: string) {
    const connector = CONNECTOR_CATALOG.find((item) => item.id === connectorId);
    if (!connector) throw new Error("Unknown connector.");
    if (!connector.backend) throw new Error("This connection is not available yet.");
    const ts = new Date().toISOString();
    getControlDb()
      .prepare(
        `INSERT INTO connector_links (id, workspace_id, connector_id, status, metadata, created_at, updated_at)
         VALUES (?, ?, ?, 'CONNECTED', '{}', ?, ?)
         ON CONFLICT(workspace_id, connector_id) DO UPDATE SET status = 'CONNECTED', updated_at = excluded.updated_at`,
      )
      .run(id("lnk"), workspaceId, connectorId, ts, ts);
    return this.list(workspaceId);
  },

  /**
   * Real connectors (CSV / Excel, IMAP, WhatsApp, MCP, outbound) live in the workspace DB registry
   * (lib/connectors). This catalog keeps the manual sources and the honest "coming soon" list.
   */
  connectors(db: DatabaseSync, workspaceId: string): RegistryConnectorView[] {
    return ConnectorRegistry.for(db, workspaceId).list();
  },

  connectedCount(workspaceId: string, db?: DatabaseSync) {
    const manual = this.list(workspaceId).filter((item) => item.connected).length;
    if (!db) return manual;
    return manual + this.connectors(db, workspaceId).filter((item) => item.state === "connected").length;
  },
};
