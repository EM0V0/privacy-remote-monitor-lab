import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { releasePrivateMean } from "@/lib/privacy/private-release";

const originalEnv = { ...process.env };

const createdReleaseIds: string[] = [];
const createdLedgerIds: string[] = [];

function setPrivacyEnv(overrides: NodeJS.ProcessEnv = {}) {
  process.env = {
    ...originalEnv,
    DATABASE_URL: originalEnv.DATABASE_URL ?? "file:./dev.db",
    PRIVACY_K_MIN: "2",
    DP_EPSILON_PER_QUERY: "0.05",
    PRIVACY_EPSILON_DAILY_CAP: "100",
    PRIVACY_EPSILON_COMPOSITION_CAP: "100",
    PRIVACY_COMPOSITION_DELTA_PRIME: "1e-6",
    DP_CLIP_MIN: "0",
    DP_CLIP_MAX: "100",
    PRIVACY_RDP_ALPHA: "8",
    PRIVACY_RDP_REPORT_DELTA: "1e-5",
    PRIVACY_ENABLE_RDP_GATE: "0",
    ...overrides,
  };
}

describe.skipIf(!process.env.DATABASE_URL)("releasePrivateMean evidence records", () => {
  afterEach(async () => {
    process.env = { ...originalEnv };

    if (createdReleaseIds.length > 0) {
      await prisma.privacyRelease.deleteMany({ where: { id: { in: [...createdReleaseIds] } } });
      createdReleaseIds.length = 0;
    }

    if (createdLedgerIds.length > 0) {
      await prisma.privacyLedger.deleteMany({ where: { id: { in: [...createdLedgerIds] } } });
      createdLedgerIds.length = 0;
    }
  });

  it("creates atomic ledger, audit, and structured evidence for a successful release", async () => {
    setPrivacyEnv();

    const result = await releasePrivateMean({ scores: [10, 20, 200] });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.detail);

    createdReleaseIds.push(result.evidence.releaseId);
    createdLedgerIds.push(result.evidence.ledgerId);

    expect(result.trueMean).toBeCloseTo((10 + 20 + 100) / 3, 8);
    expect(result.evidence.auditEntryHash).toHaveLength(64);

    const release = await prisma.privacyRelease.findUnique({
      where: { id: result.evidence.releaseId },
    });
    expect(release?.status).toBe("released");
    expect(release?.ledgerId).toBe(result.evidence.ledgerId);
    expect(release?.auditEventId).toBe(result.evidence.auditEventId);
    expect(release?.cohortSize).toBe(3);
    expect(release?.trueMean).toBeCloseTo(result.trueMean, 8);
    expect(release?.denialReason).toBeNull();

    const ledger = await prisma.privacyLedger.findUnique({
      where: { id: result.evidence.ledgerId },
    });
    expect(ledger?.epsilon).toBe(result.epsilon);
    expect(ledger?.mechanism).toBe("laplace_mean");

    const audit = await prisma.auditEvent.findUnique({
      where: { id: result.evidence.auditEventId },
    });
    expect(audit?.eventType).toBe("PRIVACY_RELEASE");
    expect(audit?.chainEntryHash).toBe(result.evidence.auditEntryHash);
  });

  it("records a k-threshold denial as evidence without creating a ledger row", async () => {
    setPrivacyEnv({ PRIVACY_K_MIN: "10" });

    const result = await releasePrivateMean({ scores: [10, 20] });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected denial");
    createdReleaseIds.push(result.evidence.releaseId);

    expect(result.reason).toBe("k_anonymity");
    expect(result.evidence.ledgerId).toBeUndefined();

    const release = await prisma.privacyRelease.findUnique({
      where: { id: result.evidence.releaseId },
    });
    expect(release?.status).toBe("denied");
    expect(release?.denialReason).toBe("k_anonymity");
    expect(release?.ledgerId).toBeNull();
    expect(release?.noisyMean).toBeNull();
    expect(release?.cohortSize).toBe(2);

    const audit = await prisma.auditEvent.findUnique({
      where: { id: result.evidence.auditEventId },
    });
    expect(audit?.eventType).toBe("PRIVACY_RELEASE_DENIED");
  });

  it("records budget exhaustion as a denied release attempt", async () => {
    setPrivacyEnv({
      DP_EPSILON_PER_QUERY: "0.5",
      PRIVACY_EPSILON_DAILY_CAP: "1",
      PRIVACY_EPSILON_COMPOSITION_CAP: "100",
    });

    const blockingLedger = await prisma.privacyLedger.create({
      data: {
        epsilon: 1,
        delta: 0,
        mechanism: "laplace_mean",
        renyiOrder: 8,
        queryType: "__vitest_budget_block__",
      },
    });
    createdLedgerIds.push(blockingLedger.id);

    const result = await releasePrivateMean({ scores: [10, 20, 30] });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected denial");
    createdReleaseIds.push(result.evidence.releaseId);

    expect(result.reason).toBe("budget_exhausted");
    expect(result.evidence.ledgerId).toBeUndefined();

    const release = await prisma.privacyRelease.findUnique({
      where: { id: result.evidence.releaseId },
    });
    expect(release?.status).toBe("denied");
    expect(release?.denialReason).toBe("budget_exhausted");
    expect(release?.ledgerId).toBeNull();
    expect(release?.epsilon).toBe(0.5);
  });

  it("fails closed when the DP clipping policy is invalid", async () => {
    setPrivacyEnv({
      DP_CLIP_MIN: "100",
      DP_CLIP_MAX: "0",
    });

    const result = await releasePrivateMean({ scores: [10, 20, 30] });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected denial");
    createdReleaseIds.push(result.evidence.releaseId);

    expect(result.reason).toBe("invalid_policy_config");

    const release = await prisma.privacyRelease.findUnique({
      where: { id: result.evidence.releaseId },
    });
    expect(release?.status).toBe("denied");
    expect(release?.denialReason).toBe("invalid_policy_config");
    expect(release?.ledgerId).toBeNull();
  });

  it("records advanced-composition exhaustion before spending budget", async () => {
    setPrivacyEnv({
      DP_EPSILON_PER_QUERY: "0.5",
      PRIVACY_EPSILON_DAILY_CAP: "100",
      PRIVACY_EPSILON_COMPOSITION_CAP: "1",
    });

    const result = await releasePrivateMean({ scores: [10, 20, 30] });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected denial");
    createdReleaseIds.push(result.evidence.releaseId);

    expect(result.reason).toBe("composition_exhausted");

    const release = await prisma.privacyRelease.findUnique({
      where: { id: result.evidence.releaseId },
    });
    expect(release?.status).toBe("denied");
    expect(release?.denialReason).toBe("composition_exhausted");
    expect(release?.ledgerId).toBeNull();
    expect(release?.advancedEpsilonAfter).toBeGreaterThan(1);
  });

  it("records RDP conversion exhaustion when the optional RDP gate is enabled", async () => {
    setPrivacyEnv({
      DP_EPSILON_PER_QUERY: "0.05",
      PRIVACY_EPSILON_DAILY_CAP: "100",
      PRIVACY_EPSILON_COMPOSITION_CAP: "100",
      PRIVACY_ENABLE_RDP_GATE: "1",
      PRIVACY_RDP_ALPHA: "2",
      PRIVACY_RDP_REPORT_DELTA: "1e-300",
    });

    const result = await releasePrivateMean({ scores: [10, 20, 30] });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected denial");
    createdReleaseIds.push(result.evidence.releaseId);

    expect(result.reason).toBe("rdp_conversion_exhausted");

    const release = await prisma.privacyRelease.findUnique({
      where: { id: result.evidence.releaseId },
    });
    expect(release?.status).toBe("denied");
    expect(release?.denialReason).toBe("rdp_conversion_exhausted");
    expect(release?.ledgerId).toBeNull();
    expect(release?.rdpGateEnabled).toBe(true);
  });
});
