import { prisma } from "@/lib/prisma";

export type DpSnapshot = {
  id?: string;
  createdAt?: string;
  noisyMean: number;
  trueMean: number;
  n: number;
  epsilon: number;
  sensitivity: number;
  auditEventId?: string | null;
  auditEntryHash?: string | null;
  ledgerId?: string | null;
  purpose?: string;
  mechanism?: string;
  clipLo?: number;
  clipHi?: number;
  advancedEpsilonAfter?: number;
};

/**
 * Reads the latest successful Laplace mean release.
 * New releases use structured evidence rows; audit metadata remains as a legacy fallback.
 */
export async function getLatestDpReleaseFromAudit(): Promise<DpSnapshot | null> {
  const release = await prisma.privacyRelease.findFirst({
    where: { status: "released" },
    orderBy: { createdAt: "desc" },
  });

  if (
    release &&
    typeof release.noisyMean === "number" &&
    typeof release.trueMean === "number" &&
    typeof release.sensitivity === "number"
  ) {
    return {
      id: release.id,
      createdAt: release.createdAt.toISOString(),
      noisyMean: release.noisyMean,
      trueMean: release.trueMean,
      n: release.cohortSize,
      epsilon: release.epsilon,
      sensitivity: release.sensitivity,
      auditEventId: release.auditEventId,
      auditEntryHash: release.auditEntryHash,
      ledgerId: release.ledgerId,
      purpose: release.purpose,
      mechanism: release.mechanism,
      clipLo: release.clipLo,
      clipHi: release.clipHi,
      advancedEpsilonAfter: release.advancedEpsilonAfter ?? undefined,
    };
  }

  const row = await prisma.auditEvent.findFirst({
    where: { eventType: "PRIVACY_RELEASE" },
    orderBy: { createdAt: "desc" },
  });
  if (!row?.metadata) return null;
  try {
    const m = JSON.parse(row.metadata) as {
      noisyMean?: unknown;
      trueMean?: unknown;
      epsilon?: unknown;
      n?: unknown;
      sensitivity?: unknown;
    };
    if (
      typeof m.noisyMean !== "number" ||
      typeof m.trueMean !== "number" ||
      typeof m.epsilon !== "number" ||
      typeof m.n !== "number" ||
      typeof m.sensitivity !== "number"
    ) {
      return null;
    }
    return {
      noisyMean: m.noisyMean,
      trueMean: m.trueMean,
      n: m.n,
      epsilon: m.epsilon,
      sensitivity: m.sensitivity,
    };
  } catch {
    return null;
  }
}
