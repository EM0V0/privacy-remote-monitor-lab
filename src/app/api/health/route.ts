import { NextResponse } from "next/server";

/**
 * Liveness probe — returns JSON suitable for orchestrators and synthetic checks.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "privacy-remote-monitor-lab",
    timestamp: new Date().toISOString(),
  });
}
