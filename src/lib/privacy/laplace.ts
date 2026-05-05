import { randomInt } from "crypto";

/** Uniform integers via crypto.randomInt; span must stay within Node's safe random range (~< 2^48). */
const DENOM = 2 ** 48;

/**
 * Near-uniform (0, 1) using `crypto.randomInt` (no BigInt / ES2020 requirement).
 */
function nextOpen01(): number {
  const k = randomInt(1, DENOM - 1); // [1, 2^48 - 2]
  const u = k / DENOM;
  return Math.min(Math.max(u, Number.EPSILON), 1 - Number.EPSILON);
}

/**
 * Laplace(0, scale) sample via inverse CDF.
 */
export function laplaceNoise(scale: number): number {
  if (!(scale > 0)) return 0;
  const u = nextOpen01();
  const v = u - 0.5;
  return -scale * Math.sign(v) * Math.log(1 - 2 * Math.abs(v));
}
