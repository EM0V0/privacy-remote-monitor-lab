/**
 * Advanced composition bound for k-fold adaptive composition of homogeneous (ε, 0)-DP mechanisms.
 *
 * Uses the standard analytic form from the DP composition literature (see Dwork & Roth, Thm. 3.20;
 * refined optimal constants appear in Kairouz et al., JMLR 2015). For identical ε per mechanism:
 *
 *   ε_adv(k) ≤ √(2 k ln(1/δ')) · ε + k ε (e^ε − 1)
 *
 * Interpret δ' as the privacy slack allocated to this composition analysis (not per-query δ unless modeled).
 * This module is for **budget governance demos** — full adaptive heterogeneous schedules need DP accountants.
 */

export function advancedCompositionEpsilonHomogeneous(
  k: number,
  epsilon: number,
  deltaPrime: number,
): number {
  if (k < 1 || !Number.isFinite(k)) {
    throw new RangeError("k must be a positive finite integer.");
  }
  if (!(epsilon > 0) || !Number.isFinite(epsilon)) {
    throw new RangeError("epsilon must be positive and finite.");
  }
  if (!(deltaPrime > 0) || !(deltaPrime < 1)) {
    throw new RangeError("deltaPrime must lie in (0, 1).");
  }

  const kk = Math.floor(k);
  return (
    Math.sqrt(2 * kk * Math.log(1 / deltaPrime)) * epsilon + kk * epsilon * (Math.exp(epsilon) - 1)
  );
}

/**
 * Conservative surrogate ε_max when mechanisms differ — worst-case ε among pending queries.
 */
export function maxEpsilonLedger(entries: { epsilon: number }[], incoming: number): number {
  let m = incoming;
  for (const row of entries) {
    if (row.epsilon > m) m = row.epsilon;
  }
  return m;
}
