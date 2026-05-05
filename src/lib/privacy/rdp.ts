/**
 * Rényi differential privacy (RDP) helpers aligned with Mironov, CCS 2017.
 *
 * Laplace RDP curve — closed form D_α between Λ(0, λ) and Λ(1, λ) (sensitivity 1)
 * with ε-calibrated Laplace noise scale λ = 1/ε (Prop. 6 / Table II in the paper).
 *
 * Composition: k adaptive mechanisms that are each (α, ρ_i)-RDP under the same α
 * compose to (α, Σ ρ_i)-RDP (standard additive Renyi composition).
 *
 * Conversion to approximate DP (Remark after Prop. 3 in the same reference family):
 *   (ε, δ)-DP with ε ≤ ρ + ln(1/δ)/(α − 1).
 */

/**
 * Renyi divergence order α must exceed 1 for the Laplace closed form used here.
 */
export function assertValidRenyiOrder(alpha: number): void {
  if (!(alpha > 1) || !Number.isFinite(alpha)) {
    throw new RangeError("Renyi order alpha must be finite and strictly greater than 1.");
  }
}

/**
 * Laplace mechanism L_λ f with ℓ1-sensitivity 1, calibrated to pure ε-DP via λ = 1/ε.
 * Returns ρ(α) such that the mechanism satisfies (α, ρ)-RDP for neighboring databases.
 */
export function laplaceCalibratedRenyiRho(epsilon: number, alpha: number): number {
  assertValidRenyiOrder(alpha);
  if (!(epsilon > 0) || !Number.isFinite(epsilon)) {
    throw new RangeError("epsilon must be positive and finite.");
  }

  const lam = 1 / epsilon;
  const coef = 2 * alpha - 1;
  const term1 = (alpha / coef) * Math.exp((alpha - 1) / lam);
  const term2 = ((alpha - 1) / coef) * Math.exp(-alpha / lam);
  return (1 / (alpha - 1)) * Math.log(term1 + term2);
}

/** Linear composition of independent RDP budgets at fixed Renyi order α. */
export function sumRenyiRho(rhos: number[]): number {
  let s = 0;
  for (const rho of rhos) {
    if (!(rho >= 0) || !Number.isFinite(rho)) {
      throw new RangeError("Each Renyi rho must be finite and non-negative.");
    }
    s += rho;
  }
  return s;
}

/**
 * Converts an (α, ρ_sum)-RDP guarantee into an (ε, δ)-DP upper bound (standard Mironov lemma).
 */
export function epsilonUpperBoundFromRenyiRhoSum(rhoSum: number, alpha: number, delta: number): number {
  assertValidRenyiOrder(alpha);
  if (!(rhoSum >= 0) || !Number.isFinite(rhoSum)) {
    throw new RangeError("rhoSum must be finite and non-negative.");
  }
  if (!(delta > 0) || !(delta < 1)) {
    throw new RangeError("delta must lie strictly between 0 and 1.");
  }
  return rhoSum + Math.log(1 / delta) / (alpha - 1);
}
