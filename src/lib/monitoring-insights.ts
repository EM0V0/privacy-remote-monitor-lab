import { computeCusum } from "@/lib/algorithms/cusum";
import { robustMedianDrift } from "@/lib/algorithms/drift";
import { computeEwma } from "@/lib/algorithms/ewma";
import { mad, median, robustSigmaFromMad } from "@/lib/algorithms/robust";

export type MonitoringChartRow = {
  t: string;
  score: number;
  ewma: number;
  cusumPos: number;
  cusumNeg: number;
  alarm: boolean;
};

export type MonitoringInsights = {
  chart: MonitoringChartRow[];
  drift: ReturnType<typeof robustMedianDrift>;
  cusumThreshold: number;
  cusumSlack: number;
  ewmaLambda: number;
  /** True if any timestep crossed CUSUM threshold. */
  cusumTriggered: boolean;
};

function readNum(env: string | undefined, fallback: number): number {
  const x = Number(env);
  return Number.isFinite(x) ? x : fallback;
}

/**
 * Builds EWMA + CUSUM overlays and robust drift metrics from an aligned time/score series.
 */
export function computeMonitoringInsights(points: { t: string; score: number }[]): MonitoringInsights {
  const values = points.map((p) => p.score);
  const ewmaLambda = readNum(process.env.EWMA_LAMBDA, 0.25);
  const recentWindow = Math.max(5, Math.floor(readNum(process.env.DRIFT_RECENT_WINDOW, 12)));
  const driftZThr = readNum(process.env.DRIFT_Z_THRESHOLD, 1.25);
  const cusumSlack = readNum(process.env.CUSUM_SLACK, 0.35);
  const cusumThreshold = readNum(process.env.CUSUM_THRESHOLD, 4);

  const ewma = computeEwma(values, ewmaLambda);

  const trainSlice = values.slice(0, Math.max(8, Math.floor(values.length * 0.35)));
  const mu0 = median(trainSlice);
  const mad0 = mad(trainSlice, mu0);
  const sigma0 = robustSigmaFromMad(mad0);

  const { pos, neg, alarms } = computeCusum(values, mu0, sigma0, cusumSlack, cusumThreshold);

  const chart: MonitoringChartRow[] = points.map((p, i) => ({
    t: p.t,
    score: Math.round(p.score * 10) / 10,
    ewma: Math.round(ewma[i]! * 10) / 10,
    cusumPos: Math.round(pos[i]! * 100) / 100,
    cusumNeg: Math.round(neg[i]! * 100) / 100,
    alarm: alarms[i]!,
  }));

  const drift = robustMedianDrift(values, recentWindow, driftZThr);
  const cusumTriggered = alarms.some(Boolean);

  return {
    chart,
    drift,
    cusumThreshold,
    cusumSlack,
    ewmaLambda,
    cusumTriggered,
  };
}
