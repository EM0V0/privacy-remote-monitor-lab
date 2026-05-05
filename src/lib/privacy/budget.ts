import { prisma } from "@/lib/prisma";

const DAY_MS = 86_400_000;

/**
 * Sums epsilon spent in the sliding 24h window (basic ledger accounting).
 */
export async function epsilonSpentLast24h(): Promise<number> {
  const since = new Date(Date.now() - DAY_MS);
  const agg = await prisma.privacyLedger.aggregate({
    _sum: { epsilon: true },
    where: { createdAt: { gte: since } },
  });
  return agg._sum.epsilon ?? 0;
}

export function readPrivacyEnv(): {
  kMin: number;
  epsilonPerQuery: number;
  dailyEpsilonCap: number;
  clipLo: number;
  clipHi: number;
} {
  return {
    kMin: Math.max(2, Number(process.env.PRIVACY_K_MIN ?? 10)),
    epsilonPerQuery: Math.max(1e-6, Number(process.env.DP_EPSILON_PER_QUERY ?? 0.5)),
    dailyEpsilonCap: Math.max(
      Number(process.env.DP_EPSILON_PER_QUERY ?? 0.5),
      Number(process.env.PRIVACY_EPSILON_DAILY_CAP ?? 4),
    ),
    clipLo: Number(process.env.DP_CLIP_MIN ?? 0),
    clipHi: Number(process.env.DP_CLIP_MAX ?? 100),
  };
}
