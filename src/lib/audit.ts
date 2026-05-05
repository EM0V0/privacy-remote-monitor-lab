import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";

import {
  AUDIT_CHAIN_GENESIS_HASH,
  auditEntryHashFromPayload,
  buildAuditPayloadV1,
  stableJsonStringify,
  verifyAuditChainRows,
  type AuditChainVerification,
} from "@/lib/audit-hash";
import { prisma } from "@/lib/prisma";

export type AuditWriteInput = {
  eventType: string;
  actorId?: string | null;
  subject?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditWriteResult = {
  id: string;
  chainEntryHash: string;
};

/**
 * Persists an append-only audit row with a SHA-256 hash chain over canonical payloads
 * using an existing transaction. Use this when the audited domain write must be atomic.
 */
export async function writeAuditInTransaction(
  tx: Prisma.TransactionClient,
  input: AuditWriteInput,
): Promise<AuditWriteResult> {
    const last = await tx.auditEvent.findFirst({
      orderBy: { createdAt: "desc" },
      select: { chainEntryHash: true },
    });

    const prevHash = last?.chainEntryHash ?? AUDIT_CHAIN_GENESIS_HASH;
    const id = randomUUID();

    const metaCanonical = input.metadata ? stableJsonStringify(input.metadata) : "";

    const payload = buildAuditPayloadV1({
      prevHash,
      id,
      eventType: input.eventType,
      actorId: input.actorId ?? null,
      subject: input.subject ?? null,
      metadata: metaCanonical,
    });

    const chainEntryHash = auditEntryHashFromPayload(payload);

    await tx.auditEvent.create({
      data: {
        id,
        eventType: input.eventType,
        actorId: input.actorId ?? undefined,
        subject: input.subject ?? undefined,
        metadata: metaCanonical === "" ? undefined : metaCanonical,
        chainPrevHash: prevHash,
        chainEntryHash,
      },
    });

    return { id, chainEntryHash };
}

/**
 * Persists an append-only audit row with a SHA-256 hash chain over canonical payloads.
 */
export async function writeAudit(input: AuditWriteInput): Promise<AuditWriteResult> {
  return prisma.$transaction((tx) => writeAuditInTransaction(tx, input));
}

export type AuditChainIntegrityReport =
  | AuditChainVerification
  | {
      ok: true;
      rowsVerified: number;
      legacyUnhashedRows: number;
      note: "audit_hashes:not_deployed";
    };

/**
 * Full-chain verification helper — scans every audit row chronologically.
 *
 * @param options.treatAllLegacyWithoutHashesAsOk — When every row predates hash chaining, return OK with an advisory payload (CLI default). The HTTP admin route keeps strict semantics unless you opt in later.
 */
export async function verifyAuditChainIntegrity(options?: {
  treatAllLegacyWithoutHashesAsOk?: boolean;
}): Promise<AuditChainIntegrityReport> {
  const rows = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      chainPrevHash: true,
      chainEntryHash: true,
      eventType: true,
      actorId: true,
      subject: true,
      metadata: true,
    },
  });

  if (rows.length === 0) {
    return { ok: true, rowsVerified: 0 };
  }

  const rowMissing = (row: (typeof rows)[number]) => !row.chainEntryHash || !row.chainPrevHash;
  const missingAll = rows.every(rowMissing);
  const missingAny = rows.some(rowMissing);

  if (missingAll && options?.treatAllLegacyWithoutHashesAsOk) {
    return {
      ok: true,
      rowsVerified: 0,
      legacyUnhashedRows: rows.length,
      note: "audit_hashes:not_deployed",
    };
  }

  if (missingAny) {
    const failedRowIndex = rows.findIndex(rowMissing);
    return {
      ok: false,
      rowsVerified: failedRowIndex === -1 ? 0 : failedRowIndex,
      problem: missingAll
        ? "Legacy or incomplete row missing chain hashes."
        : "Mixed hashed / legacy audit rows — truncate or backfill before verification.",
      failedRowIndex: failedRowIndex === -1 ? 0 : failedRowIndex,
    };
  }

  return verifyAuditChainRows(
    rows.map((row) => ({
      id: row.id,
      chainPrevHash: row.chainPrevHash,
      chainEntryHash: row.chainEntryHash,
      eventType: row.eventType,
      actorId: row.actorId,
      subject: row.subject,
      metadata: row.metadata,
    })),
  );
}
