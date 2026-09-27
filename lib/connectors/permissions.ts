import type { WorkspaceRole } from "../auth/types";
import type { ConnectorView } from "./types";

/**
 * Admin scope for connectors (uses #51 workspace roles):
 *   owner / admin → install, connect, credentials, OAuth, enable/disable, tool toggles, instructions.
 *   member        → sees what is enabled (and may import files / decide approvals, as before).
 *   viewer        → sees what is enabled.
 */
export type ConnectorAccess = "read" | "write" | "admin";

const ACTION_LEVEL: Record<string, ConnectorAccess> = {
  configure: "admin",
  enable: "admin",
  disable: "admin",
  test: "admin",
  sync: "admin",
  remove: "admin",
  disconnect: "admin",
  rename: "admin",
  instructions: "admin",
  tool: "admin",
  oauth_start: "admin",
  install: "admin",
};

/** Unknown actions default to admin (fail closed). */
export function connectorActionLevel(action: string): ConnectorAccess {
  return ACTION_LEVEL[action] || "admin";
}

export function canManageConnectors(role: WorkspaceRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function roleAllows(role: WorkspaceRole | string | null | undefined, level: ConnectorAccess): boolean {
  if (level === "read") return role === "owner" || role === "admin" || role === "member" || role === "viewer";
  if (level === "write") return role === "owner" || role === "admin" || role === "member";
  return canManageConnectors(role);
}

/** Members and viewers see enabled connectors only, without configuration, errors or credential state. */
export function visibleConnector(view: ConnectorView, role: WorkspaceRole | string | null | undefined): ConnectorView {
  if (canManageConnectors(role)) return view;
  return {
    ...view,
    config: {},
    secrets: {},
    fields: [],
    missing: [],
    lastError: view.lastError ? "Connector needs attention. Ask a workspace admin." : null,
    lastResult: null,
    tools: view.tools.filter((tool) => tool.enabled),
  };
}

export function visibleConnectors(views: ConnectorView[], role: WorkspaceRole | string | null | undefined): ConnectorView[] {
  if (canManageConnectors(role)) return views;
  return views.filter((view) => view.enabled).map((view) => visibleConnector(view, role));
}
