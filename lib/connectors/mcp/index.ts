import type { DatabaseSync } from "node:sqlite";
import { one, run } from "../../db";
import { boundedText, looksLikeInstruction } from "../data";
import { ConnectorError, ConnectorRegistry, type InstallAuth } from "../registry";
import { openSecrets, redactSecrets, sealSecrets } from "../secrets";
import type { PluginToolSpec } from "../types";
import { McpClient, mcpResultText, type McpToolDescriptor, type McpTransportPreference } from "./client";
import { assertUrlShape } from "./net";
import {
  buildAuthorizeUrl,
  discoverOAuth,
  exchangeCode,
  OAuthError,
  pkcePair,
  randomState,
  refreshTokens,
  registerClient,
  type OAuthClient,
} from "./oauth";
import { assertStdioCommand, McpAuthRequired, McpGrantRequired, parseArgs } from "./transports";

export * from "./client";
export { assertUrlShape, privateAddress, safeFetch } from "./net";
export { McpAuthRequired, McpGrantRequired, stdioPolicy } from "./transports";

/**
 * Annotation gating (fail closed): only readOnlyHint=true (and not destructive) is READ. Missing
 * annotations, destructiveHint, or anything else is WRITE → proposed action → Policy → human.
 */
export function toPluginTool(tool: McpToolDescriptor): PluginToolSpec {
  const annotations = tool.annotations || {};
  return {
    name: boundedText(tool.name, 80),
    title: tool.title || annotations.title ? boundedText(tool.title || annotations.title, 120) : undefined,
    description: boundedText(tool.description || tool.title || annotations.title || tool.name, 1000),
    inputSchema: tool.inputSchema && typeof tool.inputSchema === "object" ? tool.inputSchema : { type: "object" },
    permission: annotations.readOnlyHint === true && annotations.destructiveHint !== true ? "READ" : "WRITE",
    annotations: {
      readOnlyHint: annotations.readOnlyHint === true ? true : undefined,
      destructiveHint: typeof annotations.destructiveHint === "boolean" ? annotations.destructiveHint : undefined,
      idempotentHint: typeof annotations.idempotentHint === "boolean" ? annotations.idempotentHint : undefined,
      openWorldHint: typeof annotations.openWorldHint === "boolean" ? annotations.openWorldHint : undefined,
    },
  };
}

const REFRESH_SKEW_MS = 60_000;

function oauthClientFrom(auth: InstallAuth, values: Record<string, string>): OAuthClient | null {
  const clientId = values.clientId || auth.clientId;
  if (!clientId) return null;
  const clientSecret = values.clientSecret || auth.clientSecret;
  return {
    clientId,
    clientSecret,
    tokenEndpointAuth: clientSecret ? auth.tokenEndpointAuth && auth.tokenEndpointAuth !== "none" ? auth.tokenEndpointAuth : "client_secret_post" : "none",
  };
}

/** Access token for an OAuth install, refreshing it when close to expiry. */
export async function oauthAccessToken(registry: ConnectorRegistry, installId: string, force = false): Promise<string | undefined> {
  const auth = registry.getAuth(installId);
  if (!auth.accessToken) return undefined;
  const expiring = auth.expiresAt !== undefined && auth.expiresAt - Date.now() < REFRESH_SKEW_MS;
  if ((expiring || force) && auth.refreshToken && auth.tokenEndpoint) {
    const client = oauthClientFrom(auth, registry.resolve(installId).values);
    if (!client) return force ? undefined : auth.accessToken;
    try {
      const tokens = await refreshTokens({ tokenEndpoint: auth.tokenEndpoint, client, refreshToken: auth.refreshToken, resource: auth.resource || "" });
      registry.setAuth(installId, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, scope: tokens.scope }, "authorized");
      return tokens.accessToken;
    } catch {
      registry.setAuth(installId, { accessToken: undefined }, "needs_auth");
      return undefined;
    }
  }
  if (expiring && !auth.refreshToken) return undefined;
  return auth.accessToken;
}

export function mcpClientFor(registry: ConnectorRegistry, installId: string, timeoutMs = 10_000): McpClient {
  const resolved = registry.resolve(installId);
  if (resolved.manifest.id !== "mcp") throw new ConnectorError("Not an MCP connector.");
  if (!resolved.configured) throw new ConnectorError("MCP server is not configured.", 409);
  const values = resolved.values;
  const transport = (values.transport || "auto") as McpTransportPreference;
  if (transport === "stdio") {
    return new McpClient({ transport, command: values.command, args: parseArgs(values.args || ""), timeoutMs });
  }
  let auth: (() => Promise<string | undefined>) | undefined;
  if (values.authType === "bearer" && values.authorization) {
    const header = /^(bearer|basic|token)\s/i.test(values.authorization) ? values.authorization : `Bearer ${values.authorization}`;
    auth = async () => header;
  } else if (values.authType === "oauth") {
    auth = async () => {
      const token = await oauthAccessToken(registry, installId);
      return token ? `Bearer ${token}` : undefined;
    };
  }
  return new McpClient({ transport, url: values.url, auth, timeoutMs });
}

/** Run `fn` with a connected client; one refresh-and-retry on 401 for OAuth installs; maps auth errors to install state. */
async function withClient<T>(registry: ConnectorRegistry, installId: string, fn: (client: McpClient) => Promise<T>): Promise<T> {
  let client = mcpClientFor(registry, installId);
  try {
    return await fn(client);
  } catch (error) {
    await client.close().catch(() => undefined);
    const values = registry.resolve(installId).values;
    if (error instanceof McpAuthRequired && values.authType === "oauth" && registry.getAuth(installId).refreshToken) {
      const token = await oauthAccessToken(registry, installId, true);
      if (token) {
        client = mcpClientFor(registry, installId);
        try {
          return await fn(client);
        } catch (retryError) {
          error = retryError;
        }
      }
    }
    if (error instanceof McpAuthRequired) {
      registry.setAuth(installId, { wwwAuthenticate: error.wwwAuthenticate.slice(0, 500) }, "needs_auth");
    } else if (error instanceof McpGrantRequired) {
      registry.setAuth(installId, { wwwAuthenticate: error.wwwAuthenticate.slice(0, 500) }, "needs_grant");
    }
    throw error;
  } finally {
    await client.close().catch(() => undefined);
  }
}

/** Connect, list tools (+ resources/prompts when advertised), cache them on the install. */
export async function refreshMcpTools(db: DatabaseSync, workspaceId: string, installId: string) {
  const registry = ConnectorRegistry.for(db, workspaceId);
  try {
    const out = await withClient(registry, installId, async (client) => {
      const info = await client.connect();
      const tools = (await client.listTools()).map(toPluginTool);
      const resources = await client.listResources();
      const prompts = await client.listPrompts();
      return { info, tools, resources, prompts, transport: client.transportKind || "" };
    });
    registry.setTools(installId, out.tools);
    registry.setServerDetails(installId, {
      transport: out.transport,
      resources: out.resources.map((item) => ({ uri: boundedText(item.uri, 300), name: item.name ? boundedText(item.name, 120) : undefined })),
      prompts: out.prompts.map((item) => ({ name: boundedText(item.name, 120), description: item.description ? boundedText(item.description, 300) : undefined })),
      serverInfo: { name: boundedText(out.info.serverInfo?.name || "", 80), version: boundedText(out.info.serverInfo?.version || "", 40), protocolVersion: out.info.protocolVersion },
    });
    const auth = registry.getAuth(installId);
    registry.setAuthStatus(installId, auth.accessToken ? "authorized" : "none");
    const reads = out.tools.filter((tool) => tool.permission === "READ").length;
    const name = out.info.serverInfo?.name ? `${boundedText(out.info.serverInfo.name, 60)}: ` : "";
    const summary = `${name}${out.tools.length} tools (${reads} read, ${out.tools.length - reads} need approval) over ${out.transport}.`;
    registry.recordRun(installId, "test", "ok", summary, { tools: out.tools.length, reads, transport: out.transport });
    return { ok: true as const, summary, tools: out.tools, state: registry.view(installId).state };
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : "MCP connection failed.", registry.knownSecretValues(installId));
    registry.recordRun(installId, "test", "error", message);
    return { ok: false as const, summary: message, tools: [] as PluginToolSpec[], state: registry.view(installId).state };
  }
}

/** READ tools only. Output is business data: bounded, flagged, never executed. */
export async function callMcpReadTool(
  db: DatabaseSync,
  workspaceId: string,
  installId: string,
  tool: PluginToolSpec,
  args: Record<string, unknown>,
) {
  if (tool.permission !== "READ") throw new ConnectorError("Write tools require human approval.", 403);
  const registry = ConnectorRegistry.for(db, workspaceId);
  const result = await withClient(registry, installId, (client) => client.callTool(tool.name, args));
  const output = redactSecrets(mcpResultText(result), registry.knownSecretValues(installId));
  return { output, isError: Boolean(result.isError), flaggedAsInstruction: looksLikeInstruction(output) };
}

export async function callMcpWriteToolApproved(db: DatabaseSync, workspaceId: string, installId: string, toolName: string, args: Record<string, unknown>) {
  const registry = ConnectorRegistry.for(db, workspaceId);
  const result = await withClient(registry, installId, (client) => client.callTool(toolName, args));
  const output = redactSecrets(mcpResultText(result), registry.knownSecretValues(installId));
  return { output, isError: Boolean(result.isError) };
}

/** Validate MCP config at registration (admin): URL shape/SSRF or stdio allowlist. */
export function validateMcpConfig(values: Record<string, unknown>) {
  const transport = String(values.transport || "auto");
  if (transport === "stdio") {
    assertStdioCommand(String(values.command || ""));
    return;
  }
  if (values.url !== undefined) assertUrlShape(String(values.url));
}

// --- OAuth 2.1 connect flow -------------------------------------------------------------------

const STATE_TTL_MS = 10 * 60_000;

type PendingState = { verifier: string; redirectUri: string; resource: string; tokenEndpoint: string };

export async function startMcpOAuth(db: DatabaseSync, workspaceId: string, installId: string, redirectUri: string) {
  const registry = ConnectorRegistry.for(db, workspaceId);
  const resolved = registry.resolve(installId);
  if (resolved.manifest.id !== "mcp") throw new ConnectorError("Not an MCP connector.");
  if (!resolved.configured) throw new ConnectorError("Add the server URL first.", 409);
  if (resolved.values.authType !== "oauth") throw new ConnectorError("This server is not set to OAuth.", 409);
  const auth = registry.getAuth(installId);
  try {
    const discovery = await discoverOAuth(resolved.values.url, auth.wwwAuthenticate || "");
    let client = oauthClientFrom(auth, resolved.values);
    if (!client || (auth.issuer && discovery.authServer.issuer && auth.issuer !== discovery.authServer.issuer)) {
      client = await registerClient(discovery.authServer, redirectUri);
    }
    const scopes = resolved.values.scope ? resolved.values.scope.split(/[\s,]+/).filter(Boolean) : discovery.scopes;
    const pkce = pkcePair();
    const state = randomState();
    registry.setAuth(installId, {
      clientId: client.clientId,
      clientSecret: client.clientSecret,
      tokenEndpointAuth: client.tokenEndpointAuth,
      tokenEndpoint: discovery.authServer.token_endpoint,
      authorizationEndpoint: discovery.authServer.authorization_endpoint,
      issuer: discovery.authServer.issuer,
      resource: discovery.resource,
    });
    const now = Date.now();
    run(db, "DELETE FROM connector_oauth_states WHERE created_at < ?", [new Date(now - STATE_TTL_MS).toISOString()]);
    const pending: PendingState = { verifier: pkce.verifier, redirectUri, resource: discovery.resource, tokenEndpoint: discovery.authServer.token_endpoint };
    run(db, "INSERT INTO connector_oauth_states (state, install_id, sealed, created_at) VALUES (?, ?, ?, ?)", [
      state,
      installId,
      sealSecrets(pending as unknown as Record<string, string>),
      new Date(now).toISOString(),
    ]);
    const authorizeUrl = buildAuthorizeUrl({ authServer: discovery.authServer, client, redirectUri, challenge: pkce.challenge, state, resource: discovery.resource, scopes });
    return { authorizeUrl, state };
  } catch (error) {
    const message = error instanceof OAuthError || error instanceof Error ? error.message : "OAuth discovery failed.";
    registry.recordRun(installId, "test", "error", message);
    throw new ConnectorError(redactSecrets(message, registry.knownSecretValues(installId)), 502);
  }
}

export async function completeMcpOAuth(db: DatabaseSync, workspaceId: string, state: string, code: string) {
  const row = one<{ state: string; install_id: string; sealed: string; created_at: string }>(db, "SELECT * FROM connector_oauth_states WHERE state = ?", [state]);
  if (!row) throw new ConnectorError("This sign-in link expired or was already used.", 400);
  run(db, "DELETE FROM connector_oauth_states WHERE state = ?", [state]);
  if (Date.now() - new Date(row.created_at).getTime() > STATE_TTL_MS) throw new ConnectorError("This sign-in link expired.", 400);
  const pending = openSecrets(row.sealed) as unknown as PendingState;
  const registry = ConnectorRegistry.for(db, workspaceId);
  const auth = registry.getAuth(row.install_id);
  const client = oauthClientFrom(auth, registry.resolve(row.install_id).values);
  if (!client) throw new ConnectorError("OAuth client is missing. Start the connection again.", 400);
  try {
    const tokens = await exchangeCode({ tokenEndpoint: pending.tokenEndpoint, client, code, verifier: pending.verifier, redirectUri: pending.redirectUri, resource: pending.resource });
    registry.setAuth(
      row.install_id,
      { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, scope: tokens.scope, wwwAuthenticate: undefined },
      "authorized",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token exchange failed.";
    registry.recordRun(row.install_id, "test", "error", message);
    throw new ConnectorError(redactSecrets(message, registry.knownSecretValues(row.install_id)), 502);
  }
  if (!registry.isEnabled(row.install_id)) registry.setEnabled(row.install_id, true, "oauth");
  const test = await refreshMcpTools(db, workspaceId, row.install_id);
  return { installId: row.install_id, test };
}
