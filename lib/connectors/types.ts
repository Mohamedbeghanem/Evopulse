/**
 * Connector + plugin manifests.
 *
 * Pattern adapted from OpenManus (FoundationAgents/OpenManus, app/tool/*): every capability is a
 * typed tool with a JSON-schema `parameters` block, collected in a registry keyed by name, and MCP
 * servers are proxied as namespaced tools. EvoPulse adds what OpenManus does not have: each tool
 * carries a permission (READ vs WRITE) and every write goes through Policy + human approval.
 */

export const CONNECTOR_KINDS = ["source", "outbound", "tool"] as const;
export type ConnectorKind = (typeof CONNECTOR_KINDS)[number];

export type ConfigFieldType = "text" | "url" | "number" | "boolean" | "secret" | "select";

export type ConfigField = {
  key: string;
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  /** Environment variable that can supply this value instead of the workspace form. */
  env?: string;
  placeholder?: string;
  help?: string;
  /** For `select` fields. */
  options?: readonly string[];
  /** Field applies (shown + required-checked) only when another field has one of these values. */
  when?: { key: string; in?: readonly string[]; notIn?: readonly string[] };
  /** Admin-only / advanced fields are hidden from the simple connect form. */
  advanced?: boolean;
};

export type ConnectorScope =
  | "entities:write"
  | "events:write"
  | "messages:read"
  | "messages:send"
  | "tools:read"
  | "tools:write";

export type ConnectorManifest = {
  id: string;
  name: string;
  /** Primary kind first. A connector may be both a source and an outbound channel (WhatsApp). */
  kinds: readonly ConnectorKind[];
  category: string;
  summary: string;
  capabilities: readonly string[];
  readScopes: readonly ConnectorScope[];
  writeScopes: readonly ConnectorScope[];
  config: readonly ConfigField[];
  /** Env vars that must all be present for env-only configuration (used in the report / UI hint). */
  docs?: string;
  /** Multi-instance connectors (MCP) can be installed more than once. */
  multiInstance?: boolean;
};

export type ConnectorState = "connected" | "not_configured" | "needs_auth" | "needs_grant" | "error" | "disabled";

export type AuthStatus = "none" | "needs_auth" | "authorized" | "needs_grant";

export type ConnectorView = {
  installId: string;
  connectorId: string;
  name: string;
  label: string;
  kinds: ConnectorKind[];
  category: string;
  summary: string;
  capabilities: string[];
  readScopes: string[];
  writeScopes: string[];
  enabled: boolean;
  state: ConnectorState;
  configured: boolean;
  missing: string[];
  /** Non-secret config values. Secrets are reported only as "set" / "env". */
  config: Record<string, string | number | boolean>;
  secrets: Record<string, "set" | "env" | "unset">;
  fields: ConfigField[];
  lastSyncAt: string | null;
  lastTestAt: string | null;
  lastError: string | null;
  lastResult: string | null;
  tools: PluginToolView[];
  catalogId: string;
  authType: "none" | "bearer" | "oauth" | "api_key";
  authStatus: AuthStatus;
  /** Admin-authored guidance the agent receives with this connector's tools. */
  instructions: string;
  disabledTools: string[];
  lastUsedAt: string | null;
  transport: string;
  resources: { uri: string; name?: string }[];
  prompts: { name: string; description?: string }[];
  serverName: string;
};

export type PluginPermission = "READ" | "WRITE";

export type PluginToolSpec = {
  /** Name as the remote server / plugin knows it. */
  name: string;
  description: string;
  /** JSON schema for arguments (OpenManus `parameters`). */
  inputSchema: Record<string, unknown>;
  permission: PluginPermission;
  title?: string;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
};

export type PluginToolView = PluginToolSpec & {
  /** Namespaced name the AgentRuntime calls: plugin__<install>__<tool>. */
  qualifiedName: string;
  installId: string;
  connectorId: string;
  /** Per-tool admin toggle. Disabled tools are never offered to the agent. */
  enabled: boolean;
};
