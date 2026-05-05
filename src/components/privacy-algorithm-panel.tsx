import { releaseDpAggregateAction } from "@/app/actions/privacy-release";

import type { MonitoringInsights } from "@/lib/monitoring-insights";
import type { DpSnapshot } from "@/lib/privacy/latest-audit-release";
import type { PrivacyAccountingSnapshot } from "@/lib/privacy/budget";

type Props = {
  insights: MonitoringInsights;
  dpSnapshot: DpSnapshot | null;
  accounting: PrivacyAccountingSnapshot;
  privacyErr: string | null;
};

/**
 * Clinician-facing synthesis of robust drift, CUSUM, and DP aggregate governance (research framing).
 * Surfaces both linear ε accounting and an analytic advanced-composition surrogate for governance previews.
 */
export function PrivacyAlgorithmPanel({ insights, dpSnapshot, accounting, privacyErr }: Props) {
  const linearHeadroom = Math.max(0, accounting.linearCap - accounting.linearSpent24h);
  const compositionHeadroom = Math.max(0, accounting.compositionEpsilonCap - accounting.advancedEpsilonIfNext);

  return (
    <section
      data-testid="privacy-algorithm-panel"
      className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-900">
        Algorithms & privacy layer
      </h2>
      <p className="mt-1 text-xs text-indigo-800/90">
        EWMA smoothing, Page–CUSUM shift detection, robust MAD drift, and Laplace mean release under k-threshold plus{" "}
        <strong>mandatory dual gates</strong> (linear ε ledger cap + analytic advanced-composition surrogate) and{" "}
        <strong>transparent Rényi bookkeeping</strong> (Mironov Laplace curve + optional conversion gate via{" "}
        <span className="font-mono">PRIVACY_ENABLE_RDP_GATE</span>).
      </p>

      <form action={releaseDpAggregateAction} className="mt-3">
        <button
          type="submit"
          data-testid="dp-release-submit"
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
            Differential privacy — Laplace mean release & budget ledger
          </dt>
          <dd className="mt-1 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Linear (24h):</span>{" "}
            {accounting.linearSpent24h.toFixed(3)} / {accounting.linearCap.toFixed(3)} ε · headroom{" "}
            {linearHeadroom.toFixed(3)} · ledger queries <span className="font-mono">{accounting.queries24h}</span>.
          </dd>
          <dd className="mt-1 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Advanced composition surrogate:</span> ε_adv (current ledger) ={" "}
            <span className="font-mono">{accounting.advancedEpsilonCurrent.toFixed(3)}</span>, ε_adv (if next release) ={" "}
            <span className="font-mono">{accounting.advancedEpsilonIfNext.toFixed(3)}</span> vs cap{" "}
            <span className="font-mono">{accounting.compositionEpsilonCap.toFixed(3)}</span> · δ′ ={" "}
            <span className="font-mono">{accounting.deltaPrime.toExponential(2)}</span> · surrogate headroom{" "}
            <span className="font-mono">{compositionHeadroom.toFixed(3)}</span>.
          </dd>
          <dd className="mt-1 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Rényi DP lens (Mironov Laplace curve · composition α):</span> Σρ ={" "}
            <span className="font-mono">{accounting.rdpRhoSum.toFixed(4)}</span> @ α ={" "}
            <span className="font-mono">{accounting.rdpCompositionAlpha.toFixed(2)}</span> (policy knob α ={" "}
            <span className="font-mono">{accounting.rdpAlpha.toFixed(2)}</span>) · converted ε_upper ≤ ρ + ln(1/δ)/(α−1) →{" "}
            <span className="font-mono">{accounting.rdpConvertedEpsilon.toFixed(3)}</span> now,{" "}
            <span className="font-mono">{accounting.rdpConvertedEpsilonIfNext.toFixed(3)}</span> if next release fires (projection α ={" "}
            <span className="font-mono">{accounting.rdpCompositionAlphaIfNext.toFixed(2)}</span>, report δ ={" "}
            <span className="font-mono">{accounting.rdpReportDelta.toExponential(2)}</span>) · optional gate{" "}
            <span className="font-mono">{accounting.enableRdpGate ? "on" : "off"}</span>.
          </dd>
          {!accounting.rdpRenyiHomogeneous ? (
            <dd className="mt-1 text-[11px] font-semibold text-amber-800">
              Ledger mixes Renyi orders — ρ sums fall back to policy α (governance surrogate; tighten ledger hygiene).
            </dd>
          ) : null}
          {!accounting.rdpRenyiHomogeneousAfterNext ? (
            <dd className="mt-1 text-[11px] font-semibold text-amber-800">
              Policy release α differs from historical ledger rows — next-query projection uses surrogate composition rules.
            </dd>
          ) : null}
          <dd className="mt-1 text-[11px] leading-snug text-slate-500">
            RDP conversion reports an approximate (<span className="font-mono">ε, δ</span>) upper bound for reviewers — compare against the same composition cap used by advanced composition; it is not additional certified HIPAA/FDA evidence.
          </dd>
          {dpSnapshot ? (
            <>
              <dd className="mt-2 font-mono text-sm text-slate-900">
                Latest released mean = {dpSnapshot.noisyMean.toFixed(2)} (true mean ={" "}
                {dpSnapshot.trueMean.toFixed(2)}, n = {dpSnapshot.n}, epsilon ={" "}
                {dpSnapshot.epsilon.toFixed(3)}, sensitivity = {dpSnapshot.sensitivity.toFixed(4)})
              </dd>
              {dpSnapshot.id ? (
                <dd className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
                  <span className="font-semibold text-slate-700">Evidence:</span>{" "}
                  release <span className="font-mono">{dpSnapshot.id}</span>
                  {dpSnapshot.purpose ? <> for <span className="font-mono">{dpSnapshot.purpose}</span></> : null}
                  {typeof dpSnapshot.clipLo === "number" && typeof dpSnapshot.clipHi === "number" ? (
                    <>
                      {" "}
                      with clip range{" "}
                      <span className="font-mono">
                        [{dpSnapshot.clipLo}, {dpSnapshot.clipHi}]
                      </span>
                    </>
                  ) : null}
                  {dpSnapshot.auditEntryHash ? (
                    <>
                      {" "}
                      and audit hash <span className="font-mono">{dpSnapshot.auditEntryHash.slice(0, 16)}...</span>
                    </>
                  ) : null}
                  .
                </dd>
              ) : null}
            </>
          ) : (
            <dd className="mt-2 text-xs text-slate-500">
              No successful release in audit log yet — use the button above (requires k threshold + mandatory DP gates).
            </dd>
          )}
        </div>
      </dl>
    </section>
  );
}
