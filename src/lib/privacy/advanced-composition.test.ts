import { describe, expect, it } from "vitest";

import { advancedCompositionEpsilonHomogeneous } from "@/lib/privacy/advanced-composition";

describe("advancedCompositionEpsilonHomogeneous", () => {
  it("rejects invalid slack δ′", () => {
    expect(() => advancedCompositionEpsilonHomogeneous(1, 0.5, 0)).toThrow(RangeError);
    expect(() => advancedCompositionEpsilonHomogeneous(1, 0.5, 1)).toThrow(RangeError);
    expect(() => advancedCompositionEpsilonHomogeneous(1, 0.5, -1)).toThrow(RangeError);
  });

  it("rejects non-positive ε", () => {
    expect(() => advancedCompositionEpsilonHomogeneous(1, 0, 1e-6)).toThrow(RangeError);
    expect(() => advancedCompositionEpsilonHomogeneous(1, -0.1, 1e-6)).toThrow(RangeError);
  });

  it("floors non-integer k consistently", () => {
    const eps = 0.4;
    const d = 1e-9;
    expect(advancedCompositionEpsilonHomogeneous(2.9, eps, d)).toBe(advancedCompositionEpsilonHomogeneous(2, eps, d));
  });

  it("is monotone in k for fixed ε, δ′", () => {
    const eps = 0.35;
    const d = 1e-8;
    const a = advancedCompositionEpsilonHomogeneous(4, eps, d);
    const b = advancedCompositionEpsilonHomogeneous(9, eps, d);
    expect(b).toBeGreaterThan(a);
  });

  it("increases when δ′ shrinks (tighter slack)", () => {
    const k = 6;
    const eps = 0.2;
    const loose = advancedCompositionEpsilonHomogeneous(k, eps, 1e-6);
    const tight = advancedCompositionEpsilonHomogeneous(k, eps, 1e-15);
    expect(tight).toBeGreaterThan(loose);
  });

  it("matches regression golden for a fixed triple", () => {
    expect(advancedCompositionEpsilonHomogeneous(5, 0.25, 1e-12)).toBeCloseTo(4.510677111532452, 10);
  });
});
