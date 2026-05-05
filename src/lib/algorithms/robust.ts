/**
 * Robust order statistics for drift-resistant summaries (MAD scale).
 */

export function medianSorted(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return medianSorted(s);
}

export function mad(values: number[], med: number): number {
  if (values.length === 0) return 0;
  const dev = values.map((x) => Math.abs(x - med));
  return median(dev);
}

/** Robust sigma proxy: 1.4826 * MAD ≈ std under Gaussian-like tails. */
export function robustSigmaFromMad(madVal: number): number {
  const s = 1.4826 * madVal;
  return s > 1e-9 ? s : 1e-9;
}
