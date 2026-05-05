import { NextResponse } from "next/server";

import { verifyAuditChainIntegrity } from "@/lib/audit";

/**
 * GET — Bearer-gated audit chain verification for ops / incident response (no session coupling).
 * Requires `ADMIN_AUDIT_SECRET` (≥16 chars recommended). Returns structured verification JSON.
 */
export async function GET(req: Request) {
  const configured = process.env.ADMIN_AUDIT_SECRET ?? "";
  if (configured.length < 16) {
    return NextResponse.json(
      {
        error: "admin_audit_unconfigured",
        hint: "Set ADMIN_AUDIT_SECRET (≥16 chars) in the server environment.",
      },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${configured}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const verification = await verifyAuditChainIntegrity();
  return NextResponse.json(verification);
}
