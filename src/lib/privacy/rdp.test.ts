import { describe, expect, it } from "vitest";

import {
  epsilonUpperBoundFromRenyiRhoSum,
  laplaceCalibratedRenyiRho,
  sumRenyiRho,
} from "@/lib/privacy/rdp";

describe("laplaceCalibratedRenyiRho", () => {
  it("matches Mironov Table II regression for λ=20, α=2 (ε=0.05)", () => {
    expect(laplaceCalibratedRenyiRho(0.05, 2)).toBeCloseTo(0.002456849734206033, 12);
  });

  it("approaches pure ε as Renyi order increases", () => {
    const eps = 0.05;
    const low = laplaceCalibratedRenyiRho(eps, 2);
    const high = laplaceCalibratedRenyiRho(eps, 500);
    expect(high).toBeGreaterThan(low);
    expect(Math.abs(high - eps)).toBeLessThan(0.002);
  });

  it("rejects invalid parameters", () => {
    expect(() => laplaceCalibratedRenyiRho(0.05, 1)).toThrow(RangeError);
    expect(() => laplaceCalibratedRenyiRho(0, 2)).toThrow(RangeError);
  });
});

describe("epsilonUpperBoundFromRenyiRhoSum", () => {
  it("implements ε ≤ ρ + ln(1/δ)/(α−1)", () => {
    const rhoSum = 1;
    const alpha = 2;
    const delta = 0.1;
    expect(epsilonUpperBoundFromRenyiRhoSum(rhoSum, alpha, delta)).toBeCloseTo(1 + Math.log(10), 12);
  });

  it("rejects invalid deltas", () => {
    expect(() => epsilonUpperBoundFromRenyiRhoSum(0, 2, 0)).toThrow(RangeError);
    expect(() => epsilonUpperBoundFromRenyiRhoSum(0, 2, 1)).toThrow(RangeError);
  });
});

describe("sumRenyiRho", () => {
  it("sums nonnegative finite budgets", () => {
    expect(sumRenyiRho([0.1, 0.2, 0.05])).toBeCloseTo(0.35, 12);
  });

  it("rejects negative contributions", () => {
    expect(() => sumRenyiRho([-1])).toThrow(RangeError);
  });
});
