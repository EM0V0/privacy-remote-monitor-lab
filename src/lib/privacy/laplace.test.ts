import { describe, expect, it } from "vitest";

import { laplaceNoise } from "@/lib/privacy/laplace";

describe("laplaceNoise", () => {
  it("returns finite values for positive scale", () => {
    for (let i = 0; i < 200; i++) {
      const x = laplaceNoise(0.8);
      expect(Number.isFinite(x)).toBe(true);
    }
  });

  /**
   * Laplace(0,b) has mean 0 — empirical average should concentrate near zero for large n.
   */
  it("has empirical mean near zero over many draws", () => {
    const scale = 1;
    const n = 12_000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += laplaceNoise(scale);
    const mean = sum / n;
    expect(Math.abs(mean)).toBeLessThan(0.12);
  });
});
