import { createHash } from "crypto";

/**
 * One-way fingerprint of the client IP for audit rows without storing raw addresses.
 */
export function hashClientIpHint(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const raw = forwarded || headers.get("x-real-ip") || undefined;
  if (!raw) return undefined;
  const salt = process.env.SESSION_SECRET ?? "dev-ip-salt";
  return createHash("sha256")
    .update(`${salt}:${raw}`)
    .digest("base64url")
    .slice(0, 24);
}
