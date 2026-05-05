import { releaseDpAggregateAction } from "@/app/actions/privacy-release";

import type { MonitoringInsights } from "@/lib/monitoring-insights";
import type { DpSnapshot } from "@/lib/privacy/latest-audit-release";
import { readPrivacyEnv } from "@/lib/privacy/budget";

type Props = {
  insights: MonitoringInsights;
  dpSnapshot: DpSnapshot | null;
  budgetSpent24h: number;
  privacyErr: string | null;
};

/**
 * Clinician-facing synthesis of robust drift, CUSUM, and DP aggregate governance (research-grade framing).
 */
export function PrivacyAlgorithmPanel({ insights, dpSnapshot, budgetSpent24h, privacyErr }: Props) {
  const { dailyEpsilonCap } = readPrivacyEnv();

  return (
    <section className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-900">
        Algorithms & privacy layer
      </h2>
      <p className="mt-1 text-xs text-indigo-800/90">
        EWMA smoothing, Page–CUSUM shift detection, robust MAD drift, and Laplace mean release under k-threshold +
        ε-day budget — explicit clinician action spends privacy budget (no silent leakage on refresh).
      </p>

      <form action={releaseDpAggregateAction} className="mt-3">
        <button
          type="submit"
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-800"
        >
          Release noisy cohort mean (Laplace · spends ε)
        </button>
      </form>

      {privacyErr ? (
        <p className="mt-2 text-sm text-amber-800" role="alert">
          {privacyErr}
        </p>
      ) : null}

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-white/60 bg-white/90 p-3 shadow-xs">
          <dt className="text-xs font-semibold uppercase text-slate-500">Robust drift</dt>
          <dd className="mt-1 font-mono text-slate-900">
            Δ_med = {(insights.drift.recentMedian - insights.drift.baselineMedian).toFixed(2)} · |Z| ={" "}
            {insights.drift.robustZ.toFixed(2)} (thr {insights.drift.zThreshold})
          </dd>
          <dd className="mt-1 text-xs text-slate-600">
            Flag {insights.drift.flagged ? <span className="font-semibold text-amber-700">raised</span> : "clear"} —
            baseline vs recent window medians with MAD scaling.
          </dd>
        </div>

        <div className="rounded-lg border border-white/60 bg-white/90 p-3 shadow-xs">
          <dt className="text-xs font-semibold uppercase text-slate-500">CUSUM</dt>
          <dd className="mt-1 font-mono text-slate-900">
            slack k={insights.cusumSlack}, h={insights.cusumThreshold}, EWMA λ={insights.ewmaLambda}
          </dd>
          <dd className="mt-1 text-xs text-slate-600">
            sustained shift{" "}
            {insights.cusumTriggered ? (
              <span className="font-semibold text-red-700">detected</span>
            ) : (
              "not detected"
            )}{" "}
            on standardized residuals.
          </dd>
        </div>

        <div className="rounded-lg border border-white/60 bg-white/90 p-3 shadow-xs sm:col-span-2">
          <dt className="text-xs font-semibold uppercase text-slate-500">
            Differential privacy — Laplace mean release
          </dt>
          <dd className="mt-1 text-xs text-slate-600">
            Budget (24h): {budgetSpent24h.toFixed(3)} / {dailyEpsilonCap.toFixed(3)} ε — ledger-backed composition
            demo.
          </dd>
          {dpSnapshot ? (
            <dd className="mt-2 font-mono text-sm text-slate-900">
              noisy μ̂ = {dpSnapshot.noisyMean.toFixed(2)} (true μ = {dpSnapshot.trueMean.toFixed(2)}, n ={" "}
              {dpSnapshot.n}, ε = {dpSnapshot.epsilon.toFixed(3)}, Δ = {dpSnapshot.sensitivity.toFixed(4)})
            </dd>
          ) : (
            <dd className="mt-2 text-xs text-slate-500">
              No successful release in audit log yet — use the button above (requires k threshold & budget).
            </dd>
          )}
        </div>
      </dl>
    </section>
  );
}
