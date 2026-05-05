/**
 * Two-sided Page–CUSUM on standardized residuals for sustained mean shifts.
 */

export type CusumSeries = {
  pos: number[];
  neg: number[];
  alarms: boolean[];
};

export function computeCusum(
  values: number[],
  mu0: number,
  sigma: number,
  slack: number,
  threshold: number,
): CusumSeries {
  const pos: number[] = [];
  const neg: number[] = [];
  const alarms: boolean[] = [];
  let sp = 0;
  let sn = 0;
  const sig = sigma > 1e-9 ? sigma : 1e-9;

  for (const x of values) {
    const z = (x - mu0) / sig;
    sp = Math.max(0, sp + z - slack);
    sn = Math.max(0, sn - z - slack);
    pos.push(sp);
    neg.push(sn);
    alarms.push(sp > threshold || sn > threshold);
  }

  return { pos, neg, alarms };
}
