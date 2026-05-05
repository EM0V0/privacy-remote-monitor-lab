import { createHash } from "crypto";

/** Payload schema version for forward-compatible verification. */
export type AuditChainPayloadV1 = {
  v: 1;
  prevHash: string;
  id: string;
  eventType: string;
  actorId: string | null;
  subject: string | null;
  /** Canonical JSON string for metadata (stable key order), or empty string if absent. */
  metadata: string;
};

export type AuditChainVerification =
  | { ok: true; rowsVerified: number }
  | { ok: false; rowsVerified: number; problem: string; failedRowIndex: number };

export const AUDIT_CHAIN_PAYLOAD_VERSION = 1 as const;

/** Deterministic UTF-8 digest used as the chain anchor before the first hashed row. */
export const AUDIT_CHAIN_GENESIS_HASH = createHash("sha256")
  .update("MeDUSA_AUDIT_CHAIN_GENESIS_v1", "utf8")
  .digest("hex");

export function sha256HexUtf8(payloadUtf8: string): string {
  return createHash("sha256").update(payloadUtf8, "utf8").digest("hex");
}

/**
 * Stable JSON encoding so hashes survive object key reordering across runtimes.
 */
export function stableJsonStringify(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number" || t === "boolean") return JSON.stringify(value);
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJsonStringify(obj[k])}`).join(",")}}`;
  }
  throw new TypeError(`Unsupported JSON-like type for audit hashing: ${t}`);
}

export function buildAuditPayloadV1(input: Omit<AuditChainPayloadV1, "v">): AuditChainPayloadV1 {
  return {
    v: AUDIT_CHAIN_PAYLOAD_VERSION,
    prevHash: input.prevHash,
    id: input.id,
    eventType: input.eventType,
    actorId: input.actorId,
    subject: input.subject,
    metadata: input.metadata,
  };
}

export function auditEntryHashFromPayload(payload: AuditChainPayloadV1): string {
  return sha256HexUtf8(stableJsonStringify(payload));
}

export type AuditChainRowInput = {
  id: string;
  chainPrevHash: string | null;
  chainEntryHash: string | null;
  eventType: string;
  actorId: string | null;
  subject: string | null;
  metadata: string | null;
};

/**
 * Verifies hash linkage for chronological audit rows (oldest → newest).
 */
export function verifyAuditChainRows(rowsChronological: AuditChainRowInput[]): AuditChainVerification {
  let prevEntryHash = AUDIT_CHAIN_GENESIS_HASH;

  for (let i = 0; i < rowsChronological.length; i++) {
    const row = rowsChronological[i];

    if (!row.chainEntryHash || !row.chainPrevHash) {
      return {
        ok: false,
        rowsVerified: i,
        problem: "Legacy or incomplete row missing chain hashes.",
        failedRowIndex: i,
      };
    }

    if (row.chainPrevHash !== prevEntryHash) {
      return {
        ok: false,
        rowsVerified: i,
        problem: "Broken chain: prevHash does not match prior entry hash.",
        failedRowIndex: i,
      };
    }

    const payload = buildAuditPayloadV1({
      prevHash: row.chainPrevHash,
      id: row.id,
      eventType: row.eventType,
      actorId: row.actorId,
      subject: row.subject,
      metadata: row.metadata ?? "",
    });

    const expected = auditEntryHashFromPayload(payload);
    if (expected !== row.chainEntryHash) {
      return {
        ok: false,
        rowsVerified: i,
        problem: "Entry hash mismatch — payload may have been tampered with.",
        failedRowIndex: i,
      };
    }

    prevEntryHash = row.chainEntryHash;
  }

  return { ok: true, rowsVerified: rowsChronological.length };
}
