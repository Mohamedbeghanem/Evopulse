import { lookup as dnsLookup } from "node:dns";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";

/**
 * Outbound HTTP for MCP + OAuth with SSRF protection and DNS-rebinding mitigation.
 *
 * The address is validated inside the socket's `lookup` hook, so the IP that is checked is the IP
 * that is connected to (resolve-and-pin per request). A hostname that resolves to a public IP at
 * registration time and a private IP later is refused at connect time. Redirects are never followed.
 */
export class NetError extends Error {}

export const MAX_RESPONSE_BYTES = 1_000_000;

export function privateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? privateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export function privateAllowed() {
  return process.env.EVOPULSE_MCP_ALLOW_PRIVATE === "true";
}

const PRIVATE_MESSAGE = "Private network MCP servers are disabled on this deploy.";

/** Static check used at registration time (and before every request). */
export function assertUrlShape(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new NetError("Invalid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new NetError("URL must be http(s).");
  if (url.username || url.password) throw new NetError("Credentials in URLs are not allowed.");
  if (!privateAllowed()) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) throw new NetError(PRIVATE_MESSAGE);
    if (isIP(host) && privateAddress(host)) throw new NetError(PRIVATE_MESSAGE);
  }
  return url;
}

/** Resolve + check (registration-time convenience; the pinned lookup below is the real guard). */
export async function assertPublicUrl(raw: string) {
  const url = assertUrlShape(raw);
  if (privateAllowed()) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : await new Promise<string[]>((resolve, reject) =>
        dnsLookup(host, { all: true }, (err, list) => (err ? reject(new NetError(`Cannot resolve ${host}.`)) : resolve(list.map((i) => i.address)))),
      );
  if (addresses.some(privateAddress)) throw new NetError(PRIVATE_MESSAGE);
}

/** Connect-time pinned lookup: resolves once, refuses private answers, hands the checked IP to the socket. */
export const pinnedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, list) => {
    if (err) return callback(err, "", 0);
    const addresses = list as { address: string; family: number }[];
    const allowed = privateAllowed() ? addresses : addresses.filter((item) => !privateAddress(item.address));
    if (!allowed.length) return callback(new NetError(PRIVATE_MESSAGE) as NodeJS.ErrnoException, "", 0);
    const pick = allowed[0];
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: typeof allowed) => void)(null, [pick]);
    callback(null, pick.address, pick.family);
  });
};

export type SafeResponse = {
  status: number;
  headers: Record<string, string>;
  /** Raw stream (SSE). Caller must consume or destroy it. */
  stream: IncomingMessage;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
};

export type SafeRequest = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function safeFetch(raw: string, init: SafeRequest = {}): Promise<SafeResponse> {
  const url = assertUrlShape(raw);
  const lib = url.protocol === "https:" ? https : http;
  const timeoutMs = init.timeoutMs ?? 10_000;
  return new Promise<SafeResponse>((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method: init.method || "GET",
        headers: { ...(init.body !== undefined ? { "Content-Length": String(Buffer.byteLength(init.body)) } : {}), ...(init.headers || {}) },
        lookup: pinnedLookup,
        timeout: timeoutMs,
        signal: init.signal,
      },
      (res) => {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (value !== undefined) headers[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value);
        }
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return reject(new NetError("Redirects are not followed for connector requests."));
        }
        let read: Promise<string> | null = null;
        const text = () =>
          (read ||= new Promise<string>((ok, fail) => {
            const chunks: Buffer[] = [];
            let size = 0;
            res.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > MAX_RESPONSE_BYTES) {
                res.destroy();
                fail(new NetError("Response too large."));
                return;
              }
              chunks.push(chunk);
            });
            res.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
            res.on("error", fail);
          }));
        resolve({
          status,
          headers,
          stream: res,
          text,
          async json<T>() {
            const body = await text();
            try {
              return JSON.parse(body || "null") as T;
            } catch {
              throw new NetError("Response was not JSON.");
            }
          },
        });
      },
    );
    req.on("timeout", () => req.destroy(new NetError("Request timed out.")));
    req.on("error", (error) => reject(error instanceof NetError ? error : new NetError(error.message.includes("Private network") ? PRIVATE_MESSAGE : `Connection failed: ${error.message}`)));
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}
