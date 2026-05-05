import { describe, expect, it } from "vitest";

import { computeCusum } from "@/lib/algorithms/cusum";

describe("computeCusum", () => {
  it("raises an alarm after a sustained positive mean shift", () => {
    const steady = Array(35).fill(50);
    const elevated = Array(35).fill(65);
    const values = [...steady, ...elevated];
    const { alarms } = computeCusum(values, 50, 5, 0.25, 4);
    expect(alarms.some(Boolean)).toBe(true);
  });

  it("stays quiet on a tightly bounded stationary series", () => {
    const values = Array(60).fill(50);
    const { alarms } = computeCusum(values, 50, 1, 0.35, 8);
    expect(alarms.every((a) => !a)).toBe(true);
  });
});
