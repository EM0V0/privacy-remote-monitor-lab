import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

function getIngestSecret(): string {
  const s = process.env.INGEST_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV !== "production") {
    return "dev-ingest-secret-change-me!!!!";
  }
  throw new Error("INGEST_SECRET must be set (≥16 characters) for telemetry ingestion in production.");
}

function timingSafeEqualString(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

const bodySchema = z.object({
  score: z.number().finite().min(0).max(100),
  recordedAt: z.coerce.date().optional(),
});

/**
 * Device-side ingestion shim — Bearer secret gates writes; validates payload with Zod.
 */
export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const prefix = "Bearer ";
    if (!auth.startsWith(prefix)) {
      return NextResponse.json({ error: "missing_bearer" }, { status: 401 });
    }
    const token = auth.slice(prefix.length).trim();
    const secret = getIngestSecret();
    if (!timingSafeEqualString(secret, token)) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
    }

    const createdAt = parsed.data.recordedAt ?? new Date();
    await prisma.observation.create({
      data: {
        score: parsed.data.score,
        createdAt,
        source: "api",
      },
    });

    await writeAudit({
      eventType: "OBSERVATION_INGEST",
      subject: "api",
      metadata: { score: parsed.data.score, recordedAt: createdAt.toISOString() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[observations ingest]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
