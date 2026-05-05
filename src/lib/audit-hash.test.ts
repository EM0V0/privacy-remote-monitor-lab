import { describe, expect, it } from "vitest";

import {
  AUDIT_CHAIN_GENESIS_HASH,
  auditEntryHashFromPayload,
  buildAuditPayloadV1,
  stableJsonStringify,
  verifyAuditChainRows,
} from "@/lib/audit-hash";

describe("stableJsonStringify", () => {
  it("orders object keys deterministically", () => {
    expect(stableJsonStringify({ b: 2, a: 1 })).toBe(`{"a":1,"b":2}`);
  });
});

describe("verifyAuditChainRows", () => {
  it("accepts a two-row linear chain starting at genesis", () => {
    const id1 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const id2 = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";

    const payload1 = buildAuditPayloadV1({
      prevHash: AUDIT_CHAIN_GENESIS_HASH,
      id: id1,
      eventType: "LOGIN_SUCCESS",
      actorId: null,
      subject: "user@demo.local",
      metadata: "",
    });
    const hash1 = auditEntryHashFromPayload(payload1);

    const payload2 = buildAuditPayloadV1({
      prevHash: hash1,
      id: id2,
      eventType: "LOGOUT",
      actorId: null,
      subject: "user@demo.local",
      metadata: stableJsonStringify({ reason: "manual" }),
    });
    const hash2 = auditEntryHashFromPayload(payload2);

    const result = verifyAuditChainRows([
      {
        id: id1,
        chainPrevHash: AUDIT_CHAIN_GENESIS_HASH,
        chainEntryHash: hash1,
        eventType: "LOGIN_SUCCESS",
        actorId: null,
        subject: "user@demo.local",
        metadata: "",
      },
      {
        id: id2,
        chainPrevHash: hash1,
        chainEntryHash: hash2,
        eventType: "LOGOUT",
        actorId: null,
        subject: "user@demo.local",
        metadata: stableJsonStringify({ reason: "manual" }),
      },
    ]);

    expect(result).toEqual({ ok: true, rowsVerified: 2 });
  });

  it("rejects tampered metadata", () => {
    const id1 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const payload1 = buildAuditPayloadV1({
      prevHash: AUDIT_CHAIN_GENESIS_HASH,
      id: id1,
      eventType: "LOGIN_SUCCESS",
      actorId: null,
      subject: "user@demo.local",
      metadata: "",
    });
    const hash1 = auditEntryHashFromPayload(payload1);

    const tampered = verifyAuditChainRows([
      {
        id: id1,
        chainPrevHash: AUDIT_CHAIN_GENESIS_HASH,
        chainEntryHash: hash1,
        eventType: "LOGIN_SUCCESS",
        actorId: null,
        subject: "user@demo.local",
        metadata: stableJsonStringify({ injected: true }),
      },
    ]);

    expect(tampered.ok).toBe(false);
  });
});
