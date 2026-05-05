/**
 * Privacy ledger helpers — Renyi composition diagnostics across heterogeneous rows.
 *
 * Summing Rényi ρ budgets requires a shared order α across composed mechanisms (Mironov 2017).
 * Rows record `renyiOrder` at spend time for provenance; if the sliding window mixes orders,
 * we fall back to the runtime policy α — additive ρ is then a governance surrogate, not a sharp theorem.
 */

export type LedgerRenyiRow = {
  renyiOrder: number;
};

/**
 * Picks the Renyi α used when converting summed Laplace ρ values into a composition snapshot.
 */
export function resolveRenyiCompositionAlpha(
  rows: LedgerRenyiRow[],
  policyAlpha: number,
): { compositionAlpha: number; renyiHomogeneous: boolean } {
  if (rows.length === 0) {
    return { compositionAlpha: policyAlpha, renyiHomogeneous: true };
  }

  const anchor = rows[0].renyiOrder;
  const renyiHomogeneous = rows.every((row) => row.renyiOrder === anchor);

  return {
    compositionAlpha: renyiHomogeneous ? anchor : policyAlpha,
    renyiHomogeneous,
  };
}

/** Extends the ledger window with a hypothetical pending release recorded at `pendingRenyiOrder`. */
export function resolveRenyiCompositionAlphaWithPending(
  rows: LedgerRenyiRow[],
  pendingRenyiOrder: number,
  policyAlpha: number,
): { compositionAlpha: number; renyiHomogeneous: boolean } {
  return resolveRenyiCompositionAlpha([...rows, { renyiOrder: pendingRenyiOrder }], policyAlpha);
}
