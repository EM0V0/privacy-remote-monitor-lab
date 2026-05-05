import { randomInt } from "crypto";

/** Matches Node `crypto.randomInt` safe span used elsewhere for uniforms. */
const DENOM = 2 ** 48;

function sampleUniformOpenUnitInterval(): number {
  const k = randomInt(1, DENOM - 1);
  return k / DENOM;
}

export type RandomizedResponseOptions = {
  /** Override uniform draws for deterministic tests (production callers omit this). */
  uniform01?: () => number;
};

/**
 * Warner randomized response for binary attributes — classical local DP primitive.
 *
 * With probability `p` report truth; otherwise flip. For symmetric RR:
 *   ε_LDP = ln(p / (1 − p)).
 *
 * Reference: Warner, Journal of the American Statistical Association, 1965.
 */
export function randomizedResponseBinary(truth: boolean, p: number, options?: RandomizedResponseOptions): boolean {
  if (!(p > 0.5) || !(p < 1)) {
    throw new RangeError("p must lie strictly between 0.5 and 1 for informative RR.");
  }
  const u = options?.uniform01?.() ?? sampleUniformOpenUnitInterval();
  if (!(u >= 0) || !(u <= 1) || !Number.isFinite(u)) {
    throw new RangeError("uniform01 must return a finite number in [0, 1].");
  }
  return u < p ? truth : !truth;
}

/** Maps Warner probability to classical ε for symmetric RR. */
export function epsilonFromWarnerProbability(p: number): number {
  if (!(p > 0.5) || !(p < 1)) {
    throw new RangeError("p must lie strictly between 0.5 and 1.");
  }
  return Math.log(p / (1 - p));
}
