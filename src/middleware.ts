import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session-jwt";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const method = req.method;

  /**
   * Browser-facing ingest protection: reject cross-origin POST when Origin is supplied.
   * Machine clients (curl, gateways) typically omit Origin — rely on Bearer secrecy there.
   */
  if (method === "POST" && path.startsWith("/api/v1/observations")) {
    const origin = req.headers.get("origin");
    if (origin) {
      const raw =
        process.env.ALLOWED_ORIGINS ??
        "http://localhost:3000,http://127.0.0.1:3000";
      const allowed = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!allowed.includes(origin)) {
        return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  const isDashboard = path.startsWith("/dashboard");
  const isPrivateAnalytics = path.startsWith("/api/v1/analytics");

  if (!isDashboard && !isPrivateAnalytics) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    if (isPrivateAnalytics) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const session = await verifySessionToken(token);
  if (!session) {
    if (isPrivateAnalytics) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    const res = NextResponse.redirect(login);
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/v1/analytics/:path*",
    "/api/v1/observations",
  ],
};
