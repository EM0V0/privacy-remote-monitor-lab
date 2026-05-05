import { mad as madFn, median, robustSigmaFromMad } from "@/lib/algorithms/robust";

export type DriftResult = {
  baselineMedian: number;
  recentMedian: number;
  robustZ: number;
  flagged: boolean;
  /** Heuristic threshold on robust Z for demo alerting (not calibrated clinically). */
  zThreshold: number;
};

/**
 * Compares recent window vs baseline window using median shift normalized by baseline MAD.
 */
export function robustMedianDrift(
  values: number[],
  recentWindow: number,
  zThreshold = 1.25,
): DriftResult {
  if (values.length < recentWindow + 5) {
    const m = median(values);
    return {
      baselineMedian: m,
      recentMedian: m,
      robustZ: 0,
      flagged: false,
      zThreshold,
    };
  }

  const baseline = values.slice(0, values.length - recentWindow);
  const recent = values.slice(values.length - recentWindow);

  const mb = median(baseline);
  const mr = median(recent);
  const madB = madFn(baseline, mb);
  const sigma = robustSigmaFromMad(madB);

  const robustZ = Math.abs(mr - mb) / sigma;

  return {
    baselineMedian: mb,
    recentMedian: mr,
    robustZ,
    flagged: robustZ >= zThreshold,
    zThreshold,
  };
}
