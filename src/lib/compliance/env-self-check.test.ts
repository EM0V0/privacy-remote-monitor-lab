import { afterEach, describe, expect, it } from "vitest";

import { evaluateRuntimeCompliance } from "@/lib/compliance/env-self-check";

describe("evaluateRuntimeCompliance", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("passes when baseline secrets and URLs are healthy", () => {
    process.env = {
      ...originalEnv,
      SESSION_SECRET: "12345678901234567890",
      INGEST_SECRET: "12345678901234567890",
      DATABASE_URL: "file:./dev.db",
      NODE_ENV: "test",
    };

    const report = evaluateRuntimeCompliance(process.env);
    expect(report.ok).toBe(true);
    expect(report.findings.filter((f) => f.severity === "error")).toHaveLength(0);
  });

  it("flags weak secrets", () => {
    process.env = {
      ...originalEnv,
      SESSION_SECRET: "short",
      INGEST_SECRET: "short",
      DATABASE_URL: "file:./dev.db",
      NODE_ENV: "test",
    };

    const report = evaluateRuntimeCompliance(process.env);
    expect(report.ok).toBe(false);
    expect(report.findings.some((f) => f.code === "SESSION_SECRET_LENGTH")).toBe(true);
    expect(report.findings.some((f) => f.code === "INGEST_SECRET_LENGTH")).toBe(true);
  });
});
