import { cookies } from "next/headers";

import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  type SessionClaims,
} from "@/lib/session-jwt";

export async function getSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
