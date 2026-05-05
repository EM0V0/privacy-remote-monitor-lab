import { describe, expect, it } from "vitest";

import { computeEwma } from "@/lib/algorithms/ewma";

describe("computeEwma", () => {
  it("returns a series of the same length as input", () => {
    const v = [1, 2, 3, 4, 5];
    const e = computeEwma(v, 0.5);
    expect(e).toHaveLength(v.length);
  });

  it("tracks a flat signal without drift", () => {
    const flat = Array(25).fill(42);
    const e = computeEwma(flat, 0.3);
    expect(e[e.length - 1]).toBeCloseTo(42, 5);
  });
});
