import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

import {
  advancedCompositionEpsilonHomogeneous,
  maxEpsilonLedger,
} from "@/lib/privacy/advanced-composition";
import {
  epsilonSpentLast24h,
  PRIVACY_WINDOW_MS,
  readPrivacyEnv,
} from "@/lib/privacy/budget";
import { resolveRenyiCompositionAlphaWithPending } from "@/lib/privacy/ledger-rdp";
import { laplaceNoise } from "@/lib/privacy/laplace";
import {
  epsilonUpperBoundFromRenyiRhoSum,
  laplaceCalibratedRenyiRho,
} from "@/lib/privacy/rdp";

export type PrivateMeanRelease =
  | {
      ok: true;
      noisyMean: number;
      trueMean: number;
      n: number;
      epsilon: number;
      sensitivity: number;
      spent24hAfter: number;
      advancedEpsilonAfter: number;
    }
  | {
      ok: false;
      reason:
        | "k_anonymity"
        | "budget_exhausted"
        | "composition_exhausted"
        | "rdp_conversion_exhausted";
      detail: string;
    };

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Laplace mechanism on the sample mean with clipping; enforces k-threshold, linear ε cap,
 * an analytic advanced-composition surrogate, and (optionally) a Mironov RDP→(ε,δ) conversion cap.
 */
export async function releasePrivateMean(params: {
  scores: number[];
  actorId?: string | null;
}): Promise<PrivateMeanRelease> {
  const env = readPrivacyEnv();
  const {
    kMin,
    epsilonPerQuery,
    dailyEpsilonCap,
    compositionEpsilonCap,
    clipLo,
    clipHi,
    deltaPrime,
    rdpAlpha,
    rdpReportDelta,
    enableRdpGate,
  } = env;
  const n = params.scores.length;

  if (n < kMin) {
    return {
      ok: false,
      reason: "k_anonymity",
      detail: `Need ≥ ${kMin} samples for aggregate release (have ${n}).`,
    };
  }

  const since = new Date(Date.now() - PRIVACY_WINDOW_MS);
  const ledgerRows = await prisma.privacyLedger.findMany({
    where: { createdAt: { gte: since } },
    select: { epsilon: true, renyiOrder: true },
    orderBy: { createdAt: "asc" },
  });

  const spent = ledgerRows.reduce((acc, row) => acc + row.epsilon, 0);
  if (spent + epsilonPerQuery > dailyEpsilonCap + 1e-9) {
    return {
      ok: false,
      reason: "budget_exhausted",
      detail: `24h linear ε budget ${dailyEpsilonCap.toFixed(3)} would be exceeded (spent ${spent.toFixed(3)}).`,
    };
  }

  const kAfter = ledgerRows.length + 1;
  const epsWorst = maxEpsilonLedger(ledgerRows, epsilonPerQuery);
  const advancedEpsilonAfter = advancedCompositionEpsilonHomogeneous(kAfter, epsWorst, deltaPrime);

  if (advancedEpsilonAfter > compositionEpsilonCap + 1e-9) {
    return {
      ok: false,
      reason: "composition_exhausted",
      detail: `Advanced-composition ε bound would reach ${advancedEpsilonAfter.toFixed(3)} (cap ${compositionEpsilonCap.toFixed(3)}, δ′=${deltaPrime.toExponential(2)}). Reduce queries or relax caps in research settings.`,
    };
  }

  if (enableRdpGate) {
    const renyiLedger = ledgerRows.map((row) => ({ renyiOrder: row.renyiOrder }));
    const nextComposition = resolveRenyiCompositionAlphaWithPending(
      renyiLedger,
      rdpAlpha,
      rdpAlpha,
    );
    const alphaConv = nextComposition.compositionAlpha;
    const rhoSumAfter =
      ledgerRows.reduce((s, row) => s + laplaceCalibratedRenyiRho(row.epsilon, alphaConv), 0) +
      laplaceCalibratedRenyiRho(epsilonPerQuery, alphaConv);
    const convertedEpsilonAfter = epsilonUpperBoundFromRenyiRhoSum(
      rhoSumAfter,
      alphaConv,
      rdpReportDelta,
    );

    if (convertedEpsilonAfter > compositionEpsilonCap + 1e-9) {
      return {
        ok: false,
        reason: "rdp_conversion_exhausted",
        detail: `RDP→(ε,δ) upper bound would reach ${convertedEpsilonAfter.toFixed(3)} (cap ${compositionEpsilonCap.toFixed(3)}, composition α=${alphaConv.toFixed(2)}, policy α=${rdpAlpha.toFixed(2)}, report δ=${rdpReportDelta.toExponential(2)}). Tune PRIVACY_RDP_* knobs or raise composition caps.`,
      };
    }
  }

  const clipped = params.scores.map((s) => clamp(s, clipLo, clipHi));
  const trueMean = clipped.reduce((a, b) => a + b, 0) / n;
  const sensitivity = (clipHi - clipLo) / n;
  const scale = sensitivity / epsilonPerQuery;
  const noisyMean = trueMean + laplaceNoise(scale);

  await prisma.privacyLedger.create({
    data: {
      epsilon: epsilonPerQuery,
      delta: 0,
      mechanism: "laplace_mean",
      renyiOrder: rdpAlpha,
      queryType: "laplace_mean",
      metadata: JSON.stringify({
        n,
        sensitivity,
        clipLo,
        clipHi,
        advancedEpsilonAfter,
        deltaPrime,
        rdpGateEnabled: enableRdpGate,
        rdpAlpha,
        rdpReportDelta,
        mechanism: "laplace_mean",
      }),
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
      advancedEpsilonAfter,
      deltaPrime,
      rdpGateEnabled: enableRdpGate,
      rdpAlpha,
      rdpReportDelta,
    },
  });

  const spent24hAfter = await epsilonSpentLast24h();

  return {
    ok: true,
    noisyMean,
    trueMean,
    n,
    epsilon: epsilonPerQuery,
    sensitivity,
    spent24hAfter,
    advancedEpsilonAfter,
  };
}
