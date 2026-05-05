import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/actions/session";
import { AuditStrip } from "@/components/audit-strip";
import { ClinicalNotice } from "@/components/clinical-notice";
import { DashboardChart } from "@/components/dashboard-chart";
import { PrivacyAlgorithmPanel } from "@/components/privacy-algorithm-panel";
import { computeMonitoringInsights } from "@/lib/monitoring-insights";
import { getPrivacyAccountingSnapshot } from "@/lib/privacy/budget";
import { getLatestDpReleaseFromAudit } from "@/lib/privacy/latest-audit-release";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const metadata = {
  title: "Monitoring dashboard",
  description: "EWMA/CUSUM/drift overlays, clinician DP releases, and audit-aware telemetry charts.",
};

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ privacyErr?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const showAuditStrip = session.role === "CLINICIAN";
  const sp = searchParams ? await searchParams : undefined;
  const privacyErrRaw = sp?.privacyErr;
  let privacyErr: string | null = null;
  if (typeof privacyErrRaw === "string") {
    try {
      privacyErr = decodeURIComponent(privacyErrRaw);
    } catch {
      privacyErr = privacyErrRaw;
    }
  }

  const rows = await prisma.observation.findMany({
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const series = rows.map((r) => ({
    t: r.createdAt.toISOString(),
    score: r.score,
  }));

  const insights = computeMonitoringInsights(series);
  const dpSnapshot = await getLatestDpReleaseFromAudit();
  const accounting = await getPrivacyAccountingSnapshot();

  const auditRows = showAuditStrip
    ? await prisma.auditEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { email: true } } },
      })
    : [];

  const noisyMean =
    dpSnapshot && showAuditStrip
      ? { value: dpSnapshot.noisyMean, epsilon: dpSnapshot.epsilon }
      : null;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monitoring dashboard</h1>
          <p className="text-sm text-slate-600">
            Signed in as <span className="font-medium text-slate-800">{session.email}</span>
            {" · "}
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              {session.role}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Secure-by-design demo: layered controls + explicit DP releases — see docs/THREAT_MODEL_STRIDE.md for STRIDE mapping
            and deferred research items.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Home
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <div className="mt-8 space-y-6">
        <ClinicalNotice variant="intendedUse" />
        <ClinicalNotice variant="transport" compact />
        {showAuditStrip ? <AuditStrip events={auditRows} /> : null}
        {showAuditStrip ? (
          <PrivacyAlgorithmPanel
            insights={insights}
            dpSnapshot={dpSnapshot}
            accounting={accounting}
            privacyErr={privacyErr}
          />
        ) : (
          <p
            data-testid="patient-dp-placeholder"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
          >
            EWMA and CUSUM overlays appear on your chart; aggregate DP releases are limited to clinician tooling in this
            demo.
          </p>
        )}
        <DashboardChart data={insights.chart} noisyMean={noisyMean} />
      </div>
    </div>
  );
}
