import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

import { epsilonSpentLast24h, readPrivacyEnv } from "@/lib/privacy/budget";
import { laplaceNoise } from "@/lib/privacy/laplace";

export type PrivateMeanRelease =
  | {
      ok: true;
      noisyMean: number;
      trueMean: number;
      n: number;
      epsilon: number;
      sensitivity: number;
      spent24hAfter: number;
    }
  | { ok: false; reason: "k_anonymity" | "budget_exhausted"; detail: string };

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Laplace mechanism on the sample mean with clipping; enforces k-threshold and daily epsilon cap.
 * One-row-one-person sensitivity model: adding/removing one clipped record shifts the mean by at most (hi-lo)/n.
 */
export async function releasePrivateMean(params: {
  scores: number[];
  actorId?: string | null;
}): Promise<PrivateMeanRelease> {
  const { kMin, epsilonPerQuery, dailyEpsilonCap, clipLo, clipHi } = readPrivacyEnv();
  const n = params.scores.length;

  if (n < kMin) {
    return {
      ok: false,
      reason: "k_anonymity",
      detail: `Need ≥ ${kMin} samples for aggregate release (have ${n}).`,
    };
  }

  const spent = await epsilonSpentLast24h();
  if (spent + epsilonPerQuery > dailyEpsilonCap + 1e-9) {
    return {
      ok: false,
      reason: "budget_exhausted",
      detail: `24h ε budget ${dailyEpsilonCap.toFixed(3)} would be exceeded (spent ${spent.toFixed(3)}).`,
    };
  }

  const clipped = params.scores.map((s) => clamp(s, clipLo, clipHi));
  const trueMean = clipped.reduce((a, b) => a + b, 0) / n;
  const sensitivity = (clipHi - clipLo) / n;
  const scale = sensitivity / epsilonPerQuery;
  const noisyMean = trueMean + laplaceNoise(scale);

  await prisma.privacyLedger.create({
    data: {
      epsilon: epsilonPerQuery,
      queryType: "laplace_mean",
      metadata: JSON.stringify({ n, sensitivity, clipLo, clipHi }),
    },
  });

  await writeAudit({
    eventType: "PRIVACY_RELEASE",
    actorId: params.actorId ?? undefined,
    subject: "aggregate_mean",
    metadata: {
      epsilon: epsilonPerQuery,
      n,
      noisyMean,
      trueMean,
      sensitivity,
      mechanism: "laplace",
    },
  });

  const spent24hAfter = spent + epsilonPerQuery;

  return {
    ok: true,
    noisyMean,
    trueMean,
    n,
    epsilon: epsilonPerQuery,
    sensitivity,
    spent24hAfter,
  };
}
