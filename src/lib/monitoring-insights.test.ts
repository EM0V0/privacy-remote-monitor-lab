import { describe, expect, it } from "vitest";

import { computeMonitoringInsights } from "@/lib/monitoring-insights";

describe("computeMonitoringInsights", () => {
  it("aligns chart rows with input timestamps", () => {
    const points = [
      { t: "2026-01-01T00:00:00.000Z", score: 40 },
      { t: "2026-01-01T01:00:00.000Z", score: 42 },
      { t: "2026-01-01T02:00:00.000Z", score: 41 },
    ];
    const out = computeMonitoringInsights(points);
    expect(out.chart).toHaveLength(3);
    expect(out.chart[0]?.t).toBe(points[0]?.t);
  });

  it("reports EWMA-smoothed values", () => {
    const points = Array.from({ length: 20 }, (_, i) => ({
      t: `2026-01-01T${String(i).padStart(2, "0")}:00:00.000Z`,
      score: 50 + (i % 3),
    }));
    const out = computeMonitoringInsights(points);
    expect(out.chart[out.chart.length - 1]!.ewma).toBeGreaterThan(0);
    expect(out.chart.every((r) => typeof r.cusumPos === "number")).toBe(true);
  });
});
