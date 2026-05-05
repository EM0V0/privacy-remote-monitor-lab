import { prisma } from "@/lib/prisma";

export type DpSnapshot = {
  noisyMean: number;
  trueMean: number;
  n: number;
  epsilon: number;
  sensitivity: number;
};

/**
 * Reads the latest successful Laplace mean release from the audit trail (for chart overlay + API snapshots).
 */
export async function getLatestDpReleaseFromAudit(): Promise<DpSnapshot | null> {
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
