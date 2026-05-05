import { prisma } from "@/lib/prisma";

import {
  advancedCompositionEpsilonHomogeneous,
  maxEpsilonLedger,
} from "@/lib/privacy/advanced-composition";
import {
  resolveRenyiCompositionAlpha,
  resolveRenyiCompositionAlphaWithPending,
} from "@/lib/privacy/ledger-rdp";
import {
  epsilonUpperBoundFromRenyiRhoSum,
  laplaceCalibratedRenyiRho,
} from "@/lib/privacy/rdp";

/** Sliding ledger window for privacy accounting (24h research demo default). */
export const PRIVACY_WINDOW_MS = 86_400_000;

export type PrivacyEnvConfig = {
  kMin: number;
  epsilonPerQuery: number;
  dailyEpsilonCap: number;
  /** Advanced-composition ε bound cap (often aligned with linear cap for demos). */
  compositionEpsilonCap: number;
  /** Slack δ′ used inside √(2k ln(1/δ′)) advanced composition bookkeeping. */
  deltaPrime: number;
  /** Fixed Renyi order for Laplace RDP bookkeeping (Mironov 2017 Table II curve). */
  rdpAlpha: number;
  /** δ used only when converting summed RDP into a reported (ε,δ)-DP upper bound. */
  rdpReportDelta: number;
  /** When true, enforce Mironov RDP conversion against compositionEpsilonCap before releases. */
  enableRdpGate: boolean;
  clipLo: number;
  clipHi: number;
  loginRateLimitPerMinute: number;
  ingestRateLimitPerMinute: number;
};

/**
 * Runtime knobs for DP releases, composition accounting, and coarse rate limits.
 */
export function readPrivacyEnv(): PrivacyEnvConfig {
  const epsilonPerQuery = Math.max(1e-9, Number(process.env.DP_EPSILON_PER_QUERY ?? 0.5));
  const dailyEpsilonCap = Math.max(
    epsilonPerQuery,
    Number(process.env.PRIVACY_EPSILON_DAILY_CAP ?? 4),
  );
  const compositionEpsilonCap = Number.isFinite(Number(process.env.PRIVACY_EPSILON_COMPOSITION_CAP))
    ? Math.max(1e-9, Number(process.env.PRIVACY_EPSILON_COMPOSITION_CAP))
    : dailyEpsilonCap;

  const deltaPrimeRaw = Number(process.env.PRIVACY_COMPOSITION_DELTA_PRIME ?? 1e-6);
  const deltaPrime =
    deltaPrimeRaw > 0 && deltaPrimeRaw < 1 ? deltaPrimeRaw : 1e-6;

  const rdpAlphaRaw = Number(process.env.PRIVACY_RDP_ALPHA ?? 8);
  const rdpAlpha = Number.isFinite(rdpAlphaRaw) && rdpAlphaRaw > 1 ? rdpAlphaRaw : 8;

  const rdpReportDeltaRaw = Number(process.env.PRIVACY_RDP_REPORT_DELTA ?? 1e-5);
  const rdpReportDelta =
    rdpReportDeltaRaw > 0 && rdpReportDeltaRaw < 1 ? rdpReportDeltaRaw : 1e-5;

  const gateRaw = (process.env.PRIVACY_ENABLE_RDP_GATE ?? "").toLowerCase();
  const enableRdpGate = gateRaw === "1" || gateRaw === "true" || gateRaw === "yes";

  return {
    kMin: Math.max(2, Math.floor(Number(process.env.PRIVACY_K_MIN ?? 10))),
    epsilonPerQuery,
    dailyEpsilonCap,
    compositionEpsilonCap,
    deltaPrime,
    rdpAlpha,
    rdpReportDelta,
    enableRdpGate,
    clipLo: Number(process.env.DP_CLIP_MIN ?? 0),
    clipHi: Number(process.env.DP_CLIP_MAX ?? 100),
    loginRateLimitPerMinute: Math.max(
      5,
      Math.floor(Number(process.env.LOGIN_RATE_LIMIT_PER_MIN ?? 45)),
    ),
    ingestRateLimitPerMinute: Math.max(
      10,
      Math.floor(Number(process.env.INGEST_RATE_LIMIT_PER_MIN ?? 240)),
    ),
  };
}

/**
 * Sums epsilon spent in the sliding 24h window (linear accounting).
 */
export async function epsilonSpentLast24h(): Promise<number> {
  const since = new Date(Date.now() - PRIVACY_WINDOW_MS);
  const agg = await prisma.privacyLedger.aggregate({
    _sum: { epsilon: true },
    where: { createdAt: { gte: since } },
  });
  return agg._sum.epsilon ?? 0;
}

export type PrivacyAccountingSnapshot = {
  linearSpent24h: number;
  linearCap: number;
  queries24h: number;
  compositionEpsilonCap: number;
  deltaPrime: number;
  /** Advanced-composition ε bound if one additional homogeneous release occurs (governance preview). */
  advancedEpsilonIfNext: number;
  /** Bound evaluated on the ledger as it stands (no hypothetical next query). */
  advancedEpsilonCurrent: number;
  /** Renyi order used when interpreting Laplace RDP sums (mirrors Mironov Table II). */
  rdpAlpha: number;
  /** δ anchor for converting summed RDP into an (ε, δ)-style reporting upper bound. */
  rdpReportDelta: number;
  /** Summed Renyi ρ over the 24h ledger at fixed α (additive composition). */
  rdpRhoSum: number;
  /** Mironov conversion ε_upper ≤ ρ_sum + ln(1/δ)/(α−1) on the current ledger. */
  rdpConvertedEpsilon: number;
  /** Conversion ε_upper after hypothetically appending one more Laplace release at DP_EPSILON_PER_QUERY. */
  rdpConvertedEpsilonIfNext: number;
  /** Whether POST releases additionally enforce the RDP conversion against compositionEpsilonCap. */
  enableRdpGate: boolean;
  /** Effective Renyi α applied to historical ρ sums (policy fallback when orders diverge). */
  rdpCompositionAlpha: number;
  /** Renyi α applied when projecting ρ after another release at the current policy order. */
  rdpCompositionAlphaIfNext: number;
  /** True when every ledger row shares the same recorded Renyi order. */
  rdpRenyiHomogeneous: boolean;
  /** True when ledger ∪ {pending policy release} shares one Renyi order. */
  rdpRenyiHomogeneousAfterNext: boolean;
};

/**
 * Dashboard / API helper summarizing linear vs advanced-composition pressure on the privacy budget.
 */
export async function getPrivacyAccountingSnapshot(): Promise<PrivacyAccountingSnapshot> {
  const env = readPrivacyEnv();
  const since = new Date(Date.now() - PRIVACY_WINDOW_MS);

  const rows = await prisma.privacyLedger.findMany({
    where: { createdAt: { gte: since } },
    select: { epsilon: true, renyiOrder: true },
    orderBy: { createdAt: "asc" },
  });

  const linearSpent24h = rows.reduce((acc, row) => acc + row.epsilon, 0);
  const k = rows.length;

  const epsWorstWithNext = maxEpsilonLedger(rows, env.epsilonPerQuery);

  let advancedEpsilonCurrent = 0;
  if (k > 0) {
    const epsWorstPast = Math.max(...rows.map((r) => r.epsilon));
    advancedEpsilonCurrent = advancedCompositionEpsilonHomogeneous(k, epsWorstPast, env.deltaPrime);
  }

  const advancedEpsilonIfNext =
    k === 0
      ? advancedCompositionEpsilonHomogeneous(1, env.epsilonPerQuery, env.deltaPrime)
      : advancedCompositionEpsilonHomogeneous(k + 1, epsWorstWithNext, env.deltaPrime);

  const renyiRows = rows.map((row) => ({ renyiOrder: row.renyiOrder }));
  const cur = resolveRenyiCompositionAlpha(renyiRows, env.rdpAlpha);
  const next = resolveRenyiCompositionAlphaWithPending(renyiRows, env.rdpAlpha, env.rdpAlpha);

  const rhoContributions = rows.map((row) =>
    laplaceCalibratedRenyiRho(row.epsilon, cur.compositionAlpha),
  );
  const rdpRhoSum = rhoContributions.reduce((acc, rho) => acc + rho, 0);
  const rdpConvertedEpsilon = epsilonUpperBoundFromRenyiRhoSum(
    rdpRhoSum,
    cur.compositionAlpha,
    env.rdpReportDelta,
  );

  const rhoContributionsNextAlpha = rows.map((row) =>
    laplaceCalibratedRenyiRho(row.epsilon, next.compositionAlpha),
  );
  const rdpRhoSumAfterNextAlpha =
    rhoContributionsNextAlpha.reduce((acc, rho) => acc + rho, 0) +
    laplaceCalibratedRenyiRho(env.epsilonPerQuery, next.compositionAlpha);

  const rdpConvertedEpsilonIfNext = epsilonUpperBoundFromRenyiRhoSum(
    rdpRhoSumAfterNextAlpha,
    next.compositionAlpha,
    env.rdpReportDelta,
  );

  return {
    linearSpent24h,
    linearCap: env.dailyEpsilonCap,
    queries24h: k,
    compositionEpsilonCap: env.compositionEpsilonCap,
    deltaPrime: env.deltaPrime,
    advancedEpsilonIfNext,
    advancedEpsilonCurrent,
    rdpAlpha: env.rdpAlpha,
    rdpReportDelta: env.rdpReportDelta,
    rdpRhoSum,
    rdpConvertedEpsilon,
    rdpConvertedEpsilonIfNext,
    enableRdpGate: env.enableRdpGate,
    rdpCompositionAlpha: cur.compositionAlpha,
    rdpCompositionAlphaIfNext: next.compositionAlpha,
    rdpRenyiHomogeneous: cur.renyiHomogeneous,
    rdpRenyiHomogeneousAfterNext: next.renyiHomogeneous,
  };
}
