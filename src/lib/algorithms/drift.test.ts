import { describe, expect, it } from "vitest";

import { robustMedianDrift } from "@/lib/algorithms/drift";

describe("robustMedianDrift", () => {
  it("flags a clear median jump between baseline and recent windows", () => {
    const baseline = Array(40).fill(50);
    const recent = Array(12).fill(72);
    const values = [...baseline, ...recent];
    const d = robustMedianDrift(values, 12, 0.4);
    expect(d.flagged).toBe(true);
    expect(d.recentMedian).toBe(72);
    expect(d.baselineMedian).toBe(50);
  });

  it("returns no flag when the series is flat", () => {
    const values = Array(30).fill(55);
    const d = robustMedianDrift(values, 8, 2);
    expect(d.flagged).toBe(false);
    expect(d.robustZ).toBe(0);
  });
});
