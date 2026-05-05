import { writeAuditInTransaction } from "@/lib/audit";
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

export type ReleaseFailureReason =
  | "invalid_policy_config"
  | "k_anonymity"
  | "budget_exhausted"
  | "composition_exhausted"
  | "rdp_conversion_exhausted";

export type ReleaseEvidenceRef = {
  releaseId: string;
  auditEventId: string;
  auditEntryHash: string;
  ledgerId?: string;
};

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
      evidence: ReleaseEvidenceRef & { ledgerId: string };
    }
  | {
      ok: false;
      reason: ReleaseFailureReason;
      detail: string;
      evidence: ReleaseEvidenceRef;
    };

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function validateReleasePolicy(env: ReturnType<typeof readPrivacyEnv>): string | null {
  if (!(Number.isFinite(env.clipLo) && Number.isFinite(env.clipHi) && env.clipLo < env.clipHi)) {
    return "DP clipping policy is invalid; DP_CLIP_MIN must be finite and lower than DP_CLIP_MAX.";
  }
  return null;
}

async function recordDeniedRelease(params: {
  actorId?: string | null;
  n: number;
  reason: ReleaseFailureReason;
  detail: string;
  advancedEpsilonAfter?: number | null;
  rdpConvertedEpsilonAfter?: number | null;
}): Promise<ReleaseEvidenceRef> {
  const env = readPrivacyEnv();

  return prisma.$transaction(async (tx) => {
    const audit = await writeAuditInTransaction(tx, {
      eventType: "PRIVACY_RELEASE_DENIED",
      actorId: params.actorId ?? undefined,
      subject: "aggregate_mean",
      metadata: {
        reason: params.reason,
        detail: params.detail,
        n: params.n,
        epsilonAttempted: env.epsilonPerQuery,
        kMin: env.kMin,
        dailyEpsilonCap: env.dailyEpsilonCap,
        compositionEpsilonCap: env.compositionEpsilonCap,
        advancedEpsilonAfter: params.advancedEpsilonAfter ?? null,
        rdpConvertedEpsilonAfter: params.rdpConvertedEpsilonAfter ?? null,
      },
    });

    const release = await tx.privacyRelease.create({
      data: {
        actorId: params.actorId ?? undefined,
        auditEventId: audit.id,
        auditEntryHash: audit.chainEntryHash,
        purpose: "remote_monitoring_quality_review",
        mechanism: "laplace_mean",
        queryType: "cohort_mean",
        cohortSize: params.n,
        epsilon: env.epsilonPerQuery,
        delta: 0,
        noisyMean: null,
        trueMean: null,
        sensitivity: null,
        clipLo: finiteOr(env.clipLo, 0),
        clipHi: finiteOr(env.clipHi, 100),
        advancedEpsilonAfter: params.advancedEpsilonAfter ?? null,
        deltaPrime: env.deltaPrime,
        rdpGateEnabled: env.enableRdpGate,
        rdpAlpha: env.rdpAlpha,
        rdpReportDelta: env.rdpReportDelta,
        status: "denied",
        denialReason: params.reason,
        detail: params.detail,
        metadata: JSON.stringify({
          evidenceVersion: 1,
          attemptedRdpConvertedEpsilon: params.rdpConvertedEpsilonAfter ?? null,
          policy: {
            kMin: env.kMin,
            dailyEpsilonCap: env.dailyEpsilonCap,
            compositionEpsilonCap: env.compositionEpsilonCap,
          },
        }),
      },
    });

    return {
      releaseId: release.id,
      auditEventId: audit.id,
      auditEntryHash: audit.chainEntryHash,
    };
  });
}

/**
 * Laplace mechanism on the sample mean with clipping.
 *
 * Secure-by-design posture:
 * - denied attempts are audited and written as evidence rows;
 * - denied attempts never spend privacy budget;
 * - successful ledger, audit, and evidence writes are atomic.
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

  const policyError = validateReleasePolicy(env);
  if (policyError) {
    const evidence = await recordDeniedRelease({
      actorId: params.actorId,
      n,
      reason: "invalid_policy_config",
      detail: policyError,
    });
    return { ok: false, reason: "invalid_policy_config", detail: policyError, evidence };
  }

  if (n < kMin) {
    const detail = `Need at least ${kMin} samples for aggregate release (have ${n}).`;
    const evidence = await recordDeniedRelease({
      actorId: params.actorId,
      n,
      reason: "k_anonymity",
      detail,
    });
    return { ok: false, reason: "k_anonymity", detail, evidence };
  }

  const since = new Date(Date.now() - PRIVACY_WINDOW_MS);
  const ledgerRows = await prisma.privacyLedger.findMany({
    where: { createdAt: { gte: since } },
    select: { epsilon: true, renyiOrder: true },
    orderBy: { createdAt: "asc" },
  });

  const spent = ledgerRows.reduce((acc, row) => acc + row.epsilon, 0);
  if (spent + epsilonPerQuery > dailyEpsilonCap + 1e-9) {
    const detail = `24h linear epsilon budget ${dailyEpsilonCap.toFixed(3)} would be exceeded (spent ${spent.toFixed(3)}).`;
    const evidence = await recordDeniedRelease({
      actorId: params.actorId,
      n,
      reason: "budget_exhausted",
      detail,
    });
    return { ok: false, reason: "budget_exhausted", detail, evidence };
  }

  const kAfter = ledgerRows.length + 1;
  const epsWorst = maxEpsilonLedger(ledgerRows, epsilonPerQuery);
  const advancedEpsilonAfter = advancedCompositionEpsilonHomogeneous(kAfter, epsWorst, deltaPrime);

  if (advancedEpsilonAfter > compositionEpsilonCap + 1e-9) {
    const detail = `Advanced-composition epsilon bound would reach ${advancedEpsilonAfter.toFixed(3)} (cap ${compositionEpsilonCap.toFixed(3)}, deltaPrime ${deltaPrime.toExponential(2)}). Reduce queries or relax caps in research settings.`;
    const evidence = await recordDeniedRelease({
      actorId: params.actorId,
      n,
      reason: "composition_exhausted",
      detail,
      advancedEpsilonAfter,
    });
    return { ok: false, reason: "composition_exhausted", detail, evidence };
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
      const detail = `RDP to epsilon upper bound would reach ${convertedEpsilonAfter.toFixed(3)} (cap ${compositionEpsilonCap.toFixed(3)}, composition alpha=${alphaConv.toFixed(2)}, policy alpha=${rdpAlpha.toFixed(2)}, report delta=${rdpReportDelta.toExponential(2)}). Tune PRIVACY_RDP_* knobs or raise composition caps.`;
      const evidence = await recordDeniedRelease({
        actorId: params.actorId,
        n,
        reason: "rdp_conversion_exhausted",
        detail,
        advancedEpsilonAfter,
        rdpConvertedEpsilonAfter: convertedEpsilonAfter,
      });
      return { ok: false, reason: "rdp_conversion_exhausted", detail, evidence };
    }
  }

  const clipped = params.scores.map((s) => clamp(s, clipLo, clipHi));
  const trueMean = clipped.reduce((a, b) => a + b, 0) / n;
  const sensitivity = (clipHi - clipLo) / n;
  const scale = sensitivity / epsilonPerQuery;
  const noisyMean = trueMean + laplaceNoise(scale);

  const evidence = await prisma.$transaction(async (tx) => {
    const ledger = await tx.privacyLedger.create({
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

    const audit = await writeAuditInTransaction(tx, {
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

    const release = await tx.privacyRelease.create({
      data: {
        actorId: params.actorId ?? undefined,
        auditEventId: audit.id,
        auditEntryHash: audit.chainEntryHash,
        ledgerId: ledger.id,
        purpose: "remote_monitoring_quality_review",
        mechanism: "laplace_mean",
        queryType: "cohort_mean",
        cohortSize: n,
        epsilon: epsilonPerQuery,
        delta: 0,
        noisyMean,
        trueMean,
        sensitivity,
        clipLo,
        clipHi,
        advancedEpsilonAfter,
        deltaPrime,
        rdpGateEnabled: enableRdpGate,
        rdpAlpha,
        rdpReportDelta,
        status: "released",
        metadata: JSON.stringify({
          evidenceVersion: 1,
          policy: {
            kMin,
            dailyEpsilonCap,
            compositionEpsilonCap,
          },
        }),
      },
    });

    return {
      releaseId: release.id,
      auditEventId: audit.id,
      auditEntryHash: audit.chainEntryHash,
      ledgerId: ledger.id,
    };
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
    evidence,
  };
}
