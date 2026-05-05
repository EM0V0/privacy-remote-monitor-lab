import { describe, expect, it } from "vitest";

import { epsilonFromWarnerProbability, randomizedResponseBinary } from "@/lib/privacy/local-dp";

describe("epsilonFromWarnerProbability", () => {
  it("maps symmetric Warner probability to ε = ln(p/(1−p))", () => {
    expect(epsilonFromWarnerProbability(0.75)).toBeCloseTo(Math.log(3), 12);
  });

  it("rejects non-informative probabilities", () => {
    expect(() => epsilonFromWarnerProbability(0.5)).toThrow(RangeError);
    expect(() => epsilonFromWarnerProbability(1)).toThrow(RangeError);
    expect(() => epsilonFromWarnerProbability(0.1)).toThrow(RangeError);
  });
});

describe("randomizedResponseBinary", () => {
  it("reports truth when the uniform draw favors the honest branch", () => {
    expect(randomizedResponseBinary(true, 0.55, { uniform01: () => 0.01 })).toBe(true);
  });

  it("flips a true response when the uniform draw favors the noisy branch", () => {
    expect(randomizedResponseBinary(true, 0.55, { uniform01: () => 0.99 })).toBe(false);
  });

  it("flips a false response when the noisy branch is selected", () => {
    expect(randomizedResponseBinary(false, 0.55, { uniform01: () => 0.99 })).toBe(true);
  });

  it("rejects unusable probability masses", () => {
    expect(() => randomizedResponseBinary(true, 0.5)).toThrow(RangeError);
    expect(() => randomizedResponseBinary(true, 1)).toThrow(RangeError);
  });

  it("rejects invalid injected uniforms", () => {
    expect(() => randomizedResponseBinary(true, 0.9, { uniform01: () => NaN })).toThrow(RangeError);
  });
});
