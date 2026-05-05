import { NextResponse } from "next/server";

import { computeMonitoringInsights } from "@/lib/monitoring-insights";
import { epsilonSpentLast24h, readPrivacyEnv } from "@/lib/privacy/budget";
import { getLatestDpReleaseFromAudit } from "@/lib/privacy/latest-audit-release";
import { releasePrivateMean } from "@/lib/privacy/private-release";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * GET — snapshot without spending ε (drift/CUSUM summary + latest audited DP release + budget).
 * POST — clinician-only Laplace mean release (same semantics as dashboard button).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "CLINICIAN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await prisma.observation.findMany({
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { createdAt: true, score: true },
  });
  const series = rows.map((r) => ({
    t: r.createdAt.toISOString(),
    score: r.score,
  }));
  const insights = computeMonitoringInsights(series);

  const spent = await epsilonSpentLast24h();
  const latest = await getLatestDpReleaseFromAudit();
  const env = readPrivacyEnv();

  return NextResponse.json({
    role: session.role,
    budget24h: spent,
    budgetCap24h: env.dailyEpsilonCap,
    kMin: env.kMin,
    epsilonPerQuery: env.epsilonPerQuery,
    latestDpRelease: latest,
    drift: insights.drift,
    cusumTriggered: insights.cusumTriggered,
  });
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "CLINICIAN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await prisma.observation.findMany({
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { score: true },
  });
  const scores = rows.map((r) => r.score);

  const dp = await releasePrivateMean({ scores, actorId: session.sub });
  const spentAfter = await epsilonSpentLast24h();

  return NextResponse.json({ dp, budget24hAfter: spentAfter });
}
