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
      DP_CLIP_MIN: "0",
      DP_CLIP_MAX: "100",
      DP_EPSILON_PER_QUERY: "0.5",
      PRIVACY_EPSILON_DAILY_CAP: "4",
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

  it("flags invalid DP sensitivity and budget configuration", () => {
    process.env = {
      ...originalEnv,
      SESSION_SECRET: "12345678901234567890",
      INGEST_SECRET: "12345678901234567890",
      DATABASE_URL: "file:./dev.db",
      NODE_ENV: "test",
      DP_CLIP_MIN: "100",
      DP_CLIP_MAX: "0",
      DP_EPSILON_PER_QUERY: "2",
      PRIVACY_EPSILON_DAILY_CAP: "1",
    };

    const report = evaluateRuntimeCompliance(process.env);
    expect(report.ok).toBe(false);
    expect(report.findings.some((f) => f.code === "DP_CLIP_RANGE_INVALID")).toBe(true);
    expect(report.findings.some((f) => f.code === "PRIVACY_EPSILON_BUDGET_INVALID")).toBe(true);
  });

  it("warns on production demo posture without treating warnings as hard failures", () => {
    process.env = {
      ...originalEnv,
      SESSION_SECRET: "12345678901234567890",
      INGEST_SECRET: "12345678901234567890",
      ADMIN_AUDIT_SECRET: "short",
      DATABASE_URL: "file:./dev.db",
      NODE_ENV: "production",
      SHOWCASE_DEMO_PASSWORD: "showcase",
      DP_CLIP_MIN: "0",
      DP_CLIP_MAX: "100",
      DP_EPSILON_PER_QUERY: "0.5",
      PRIVACY_EPSILON_DAILY_CAP: "4",
    };

    const report = evaluateRuntimeCompliance(process.env);
    expect(report.ok).toBe(true);
    expect(report.findings.some((f) => f.code === "ADMIN_AUDIT_SECRET_LENGTH")).toBe(true);
    expect(report.findings.some((f) => f.code === "SHOWCASE_PASSWORD_DEFAULT")).toBe(true);
    expect(report.findings.some((f) => f.code === "ALLOWED_ORIGINS_UNSET")).toBe(true);
    expect(report.findings.some((f) => f.code === "SQLITE_IN_PRODUCTION")).toBe(true);
  });
});
