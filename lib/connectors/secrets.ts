import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Connector secrets at rest: AES-256-GCM. Key = sha256(EVOPULSE_SECRETS_KEY) when set, otherwise a
 * random key file next to the control DB (0600). Secrets are never returned to the client or logged.
 */
function keyFilePath() {
  const control = process.env.CONTROL_DB_PATH || join(process.cwd(), "data", "control.db");
  return join(dirname(control), "connector-secrets.key");
}

let cachedKey: Buffer | null = null;
let cachedFrom = "";

function secretKey(): Buffer {
  const env = process.env.EVOPULSE_SECRETS_KEY;
  const from = env ? `env:${env.length}` : `file:${keyFilePath()}`;
  if (cachedKey && cachedFrom === from) return cachedKey;
  if (env) {
    cachedKey = createHash("sha256").update(env).digest();
  } else {
    const path = keyFilePath();
    if (!existsSync(path)) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, randomBytes(32).toString("hex"), { mode: 0o600 });
      try {
        chmodSync(path, 0o600);
      } catch {
        /* best effort */
      }
    }
    cachedKey = createHash("sha256").update(readFileSync(path, "utf8").trim()).digest();
  }
  cachedFrom = from;
  return cachedKey;
}

export function sealSecrets(values: Record<string, string>): string {
  const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => typeof v === "string" && v.length > 0));
  if (!Object.keys(clean).length) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(clean), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${body.toString("base64")}`;
}

export function openSecrets(sealed: string): Record<string, string> {
  if (!sealed) return {};
  try {
    const [version, iv, tag, body] = sealed.split(".");
    if (version !== "v1") return {};
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    const text = Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(text) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const SECRET_KEY_PATTERN = /(token|secret|password|authorization|api[-_]?key|bearer)/i;

/** Deep-redact anything that looks like a secret before it is logged, stored in a run, or rendered. */
export function redactSecrets<T>(value: T, known: string[] = []): T {
  const needles = known.filter((item) => item && item.length >= 4);
  const scrub = (input: unknown, key = ""): unknown => {
    if (typeof input === "string") {
      if (key && SECRET_KEY_PATTERN.test(key)) return input ? "[redacted]" : input;
      let out = input;
      for (const needle of needles) out = out.split(needle).join("[redacted]");
      return out.replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g, "Bearer [redacted]");
    }
    if (Array.isArray(input)) return input.map((item) => scrub(item));
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.entries(input as Record<string, unknown>).map(([k, v]) => [k, scrub(v, k)]));
    }
    return input;
  };
  return scrub(value) as T;
}
