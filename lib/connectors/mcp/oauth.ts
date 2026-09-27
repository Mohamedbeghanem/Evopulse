import { createHash, randomBytes } from "node:crypto";
import { safeFetch } from "./net";

/**
 * MCP authorization (spec 2025-06-18): OAuth 2.1 + PKCE (S256), RFC 9728 protected-resource
 * metadata, RFC 8414 / OIDC authorization-server metadata, RFC 7591 dynamic client registration,
 * RFC 8707 resource indicators, refresh tokens. Every hop uses safeFetch (SSRF + pinned DNS).
 */
export class OAuthError extends Error {}

export type ProtectedResourceMetadata = {
  resource?: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
};

export type AuthServerMetadata = {
  issuer?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
  scopes_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
};

export type OAuthClient = { clientId: string; clientSecret?: string; tokenEndpointAuth: "none" | "client_secret_post" | "client_secret_basic" };

export type OAuthTokens = { accessToken: string; refreshToken?: string; expiresAt?: number; scope?: string; tokenType?: string };

export type OAuthDiscovery = {
  resource: string;
  resourceMetadataUrl?: string;
  authServer: AuthServerMetadata;
  scopes: string[];
};

/** `Bearer resource_metadata="…", scope="…", error="…"` → map. */
export function parseWwwAuthenticate(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_]+)\s*=\s*(?:"([^"]*)"|([^\s,]+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(header || ""))) out[match[1].toLowerCase()] = match[2] ?? match[3];
  return out;
}

function base64url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pkcePair() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge, method: "S256" as const };
}

export function randomState() {
  return base64url(randomBytes(24));
}

/** Canonical resource URI for RFC 8707: scheme+host(+port)+path, no fragment/query. */
export function canonicalResource(serverUrl: string) {
  const url = new URL(serverUrl);
  url.hash = "";
  url.search = "";
  const text = url.toString();
  return url.pathname === "/" ? text.replace(/\/$/, "") : text;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await safeFetch(url, { headers: { Accept: "application/json", "MCP-Protocol-Version": "2025-06-18" }, timeoutMs: 8_000 });
    if (res.status !== 200) {
      res.stream.resume();
      return null;
    }
    return await res.json<T>();
  } catch {
    return null;
  }
}

function wellKnown(base: string, suffix: string, insertPath: boolean) {
  const url = new URL(base);
  const path = url.pathname.replace(/\/$/, "");
  return `${url.origin}/.well-known/${suffix}${insertPath && path ? path : ""}`;
}

export async function discoverProtectedResource(serverUrl: string, resourceMetadataUrl?: string) {
  const candidates = [
    ...(resourceMetadataUrl ? [resourceMetadataUrl] : []),
    wellKnown(serverUrl, "oauth-protected-resource", true),
    wellKnown(serverUrl, "oauth-protected-resource", false),
  ];
  for (const url of [...new Set(candidates)]) {
    const meta = await getJson<ProtectedResourceMetadata>(url);
    if (meta && Array.isArray(meta.authorization_servers) && meta.authorization_servers.length) return { url, meta };
  }
  return null;
}

export async function discoverAuthServer(issuer: string): Promise<AuthServerMetadata | null> {
  const candidates = [
    wellKnown(issuer, "oauth-authorization-server", true),
    wellKnown(issuer, "openid-configuration", true),
    `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
    wellKnown(issuer, "oauth-authorization-server", false),
  ];
  for (const url of [...new Set(candidates)]) {
    const meta = await getJson<AuthServerMetadata>(url);
    if (meta && meta.authorization_endpoint && meta.token_endpoint) return meta;
  }
  return null;
}

/** Full discovery from an MCP server URL (+ optional WWW-Authenticate from a 401). */
export async function discoverOAuth(serverUrl: string, wwwAuthenticate = ""): Promise<OAuthDiscovery> {
  const challenge = parseWwwAuthenticate(wwwAuthenticate);
  const prm = await discoverProtectedResource(serverUrl, challenge.resource_metadata);
  let authServer: AuthServerMetadata | null = null;
  if (prm) {
    authServer = await discoverAuthServer(prm.meta.authorization_servers![0]);
  } else {
    // 2025-03-26 fallback: the MCP server's origin is the authorization server.
    const origin = new URL(serverUrl).origin;
    authServer = (await discoverAuthServer(origin)) || {
      issuer: origin,
      authorization_endpoint: `${origin}/authorize`,
      token_endpoint: `${origin}/token`,
      registration_endpoint: `${origin}/register`,
    };
  }
  if (!authServer) throw new OAuthError("Could not discover the authorization server for this MCP server.");
  const methods = authServer.code_challenge_methods_supported;
  if (methods && methods.length && !methods.includes("S256")) throw new OAuthError("Authorization server does not support PKCE S256.");
  for (const endpoint of [authServer.authorization_endpoint, authServer.token_endpoint, authServer.registration_endpoint].filter(Boolean) as string[]) {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && !(process.env.EVOPULSE_MCP_ALLOW_PRIVATE === "true" && url.protocol === "http:")) {
      throw new OAuthError("Authorization endpoints must use HTTPS.");
    }
  }
  const scopes = (challenge.scope ? challenge.scope.split(/\s+/) : prm?.meta.scopes_supported || []).filter(Boolean).slice(0, 20);
  return { resource: prm?.meta.resource || canonicalResource(serverUrl), resourceMetadataUrl: prm?.url, authServer, scopes };
}

/** RFC 7591. Public client (PKCE, no secret) unless the server insists on one. */
export async function registerClient(authServer: AuthServerMetadata, redirectUri: string, clientName = "EvoPulse"): Promise<OAuthClient> {
  if (!authServer.registration_endpoint) throw new OAuthError("This authorization server does not offer dynamic client registration. Ask the provider for a client ID.");
  const res = await safeFetch(authServer.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    timeoutMs: 8_000,
  });
  if (res.status !== 200 && res.status !== 201) {
    res.stream.resume();
    throw new OAuthError(`Client registration failed (HTTP ${res.status}).`);
  }
  const body = await res.json<{ client_id?: string; client_secret?: string; token_endpoint_auth_method?: string }>();
  if (!body?.client_id) throw new OAuthError("Client registration returned no client_id.");
  const method = body.token_endpoint_auth_method;
  return {
    clientId: body.client_id,
    clientSecret: body.client_secret || undefined,
    tokenEndpointAuth: body.client_secret ? (method === "client_secret_basic" ? "client_secret_basic" : "client_secret_post") : "none",
  };
}

export function buildAuthorizeUrl(input: {
  authServer: AuthServerMetadata;
  client: OAuthClient;
  redirectUri: string;
  challenge: string;
  state: string;
  resource: string;
  scopes: string[];
}) {
  const url = new URL(input.authServer.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.client.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", input.state);
  url.searchParams.set("resource", input.resource);
  if (input.scopes.length) url.searchParams.set("scope", input.scopes.join(" "));
  return url.toString();
}

async function tokenRequest(tokenEndpoint: string, client: OAuthClient, params: Record<string, string>): Promise<OAuthTokens> {
  const form = new URLSearchParams(params);
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (client.tokenEndpointAuth === "client_secret_basic" && client.clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${encodeURIComponent(client.clientId)}:${encodeURIComponent(client.clientSecret)}`).toString("base64")}`;
  } else {
    form.set("client_id", client.clientId);
    if (client.tokenEndpointAuth === "client_secret_post" && client.clientSecret) form.set("client_secret", client.clientSecret);
  }
  const res = await safeFetch(tokenEndpoint, { method: "POST", headers, body: form.toString(), timeoutMs: 8_000 });
  const body = await res.json<{ access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string; error?: string }>().catch(() => null);
  if (res.status !== 200 || !body?.access_token) {
    // Never echo the provider body: it may contain the code or other secrets.
    throw new OAuthError(`Token request failed (HTTP ${res.status}${body?.error ? `, ${String(body.error).slice(0, 40)}` : ""}).`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: typeof body.expires_in === "number" ? Date.now() + body.expires_in * 1000 : undefined,
    scope: body.scope,
    tokenType: body.token_type,
  };
}

export function exchangeCode(input: { tokenEndpoint: string; client: OAuthClient; code: string; verifier: string; redirectUri: string; resource: string }) {
  return tokenRequest(input.tokenEndpoint, input.client, {
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: input.verifier,
    redirect_uri: input.redirectUri,
    resource: input.resource,
  });
}

export async function refreshTokens(input: { tokenEndpoint: string; client: OAuthClient; refreshToken: string; resource: string }) {
  const tokens = await tokenRequest(input.tokenEndpoint, input.client, {
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    resource: input.resource,
  });
  return { ...tokens, refreshToken: tokens.refreshToken || input.refreshToken };
}
