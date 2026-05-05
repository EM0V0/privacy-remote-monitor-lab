/**
 * Exponentially weighted moving average — smooths noisy biosignals while retaining recent shifts.
 */
export function computeEwma(values: number[], lambda: number): number[] {
  if (values.length === 0) return [];
  const lam = Math.min(1, Math.max(1e-6, lambda));
  const out: number[] = [];
  let prev = values[0]!;
  for (const x of values) {
    prev = lam * x + (1 - lam) * prev;
    out.push(prev);
  }
  return out;
}
