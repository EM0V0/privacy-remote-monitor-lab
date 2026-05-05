/**
 * Compact HS256 JWT helpers using the Web Crypto API — safe for Edge middleware and Node.js runtimes.
 */

export const SESSION_COOKIE_NAME = "rm_session";

export function getJwtSecretKey(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set to a strong value (≥16 characters) in production.");
    }
    return new TextEncoder().encode("dev-insecure-showcase-secret-min-16-chars!!");
  }
  return new TextEncoder().encode(raw);
}

export type SessionClaims = {
  sub: string;
  email: string;
  role: string;
};

function base64UrlEncode(buf: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importHmacKey(secret: Uint8Array): Promise<CryptoKey> {
  const raw = new Uint8Array(secret);
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function encodeJsonSegment(obj: Record<string, unknown>): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

export async function createSessionToken(params: {
  userId: string;
  email: string;
  role: string;
}): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + 60 * 60 * 8;
  const header = encodeJsonSegment({ alg: "HS256", typ: "JWT" });
  const payload = encodeJsonSegment({
    sub: params.userId,
    email: params.email,
    role: params.role,
    iat: nowSec,
    exp: expSec,
  });
  const signingInput = `${header}.${payload}`;
  const key = await importHmacKey(getJwtSecretKey());
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput),
  );
  const signature = base64UrlEncode(new Uint8Array(sigBuf));
  return `${signingInput}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const signingInput = `${h}.${p}`;
  let payloadJson: string;
  try {
    payloadJson = new TextDecoder().decode(base64UrlDecodeToBytes(p));
  } catch {
    return null;
  }
  let payload: {
    sub?: unknown;
    email?: unknown;
    role?: unknown;
    exp?: unknown;
  };
  try {
    payload = JSON.parse(payloadJson) as typeof payload;
  } catch {
    return null;
  }

  const expSec =
    typeof payload.exp === "number"
      ? payload.exp
      : typeof payload.exp === "string"
        ? Number.parseInt(payload.exp, 10)
        : NaN;
  if (!Number.isFinite(expSec) || Math.floor(Date.now() / 1000) >= expSec) {
    return null;
  }

  let sigBytes: Uint8Array;
  try {
    sigBytes = base64UrlDecodeToBytes(s);
  } catch {
    return null;
  }

  try {
    const key = await importHmacKey(getJwtSecretKey());
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      new Uint8Array(sigBytes),
      new TextEncoder().encode(signingInput),
    );
    if (!ok) return null;
  } catch {
    return null;
  }

  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  const role = typeof payload.role === "string" ? payload.role : null;
  if (!sub || !email || !role) return null;
  return { sub, email, role };
}
