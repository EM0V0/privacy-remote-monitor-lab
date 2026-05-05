export type ComplianceSeverity = "info" | "warn" | "error";

export type ComplianceFinding = {
  code: string;
  severity: ComplianceSeverity;
  message: string;
};

export type ComplianceReport = {
  ok: boolean;
  findings: ComplianceFinding[];
};

/**
 * Lightweight runtime configuration checks.
 * This is not a HIPAA/GDPR/FDA certification harness.
 */
export function evaluateRuntimeCompliance(env: NodeJS.ProcessEnv = process.env): ComplianceReport {
  const findings: ComplianceFinding[] = [];

  const sessionSecret = env.SESSION_SECRET ?? "";
  if (sessionSecret.length < 16) {
    findings.push({
      code: "SESSION_SECRET_LENGTH",
      severity: "error",
      message: "SESSION_SECRET should be at least 16 characters for HS256 session integrity.",
    });
  }

  const ingestSecret = env.INGEST_SECRET ?? "";
  if (ingestSecret.length < 16) {
    findings.push({
      code: "INGEST_SECRET_LENGTH",
      severity: "error",
      message: "INGEST_SECRET should be at least 16 characters before exposing telemetry ingest publicly.",
    });
  }

  const adminAuditSecret = env.ADMIN_AUDIT_SECRET ?? "";
  if (adminAuditSecret.length > 0 && adminAuditSecret.length < 16) {
    findings.push({
      code: "ADMIN_AUDIT_SECRET_LENGTH",
      severity: "warn",
      message: "ADMIN_AUDIT_SECRET should be at least 16 characters when audit verification is exposed.",
    });
  }

  if (!env.DATABASE_URL) {
    findings.push({
      code: "DATABASE_URL_MISSING",
      severity: "error",
      message: "DATABASE_URL must point to a database file or server.",
    });
  }

  const deltaPrimeRaw = Number(env.PRIVACY_COMPOSITION_DELTA_PRIME ?? 1e-6);
  if (!(deltaPrimeRaw > 0 && deltaPrimeRaw < 1)) {
    findings.push({
      code: "PRIVACY_DELTA_PRIME_RANGE",
      severity: "warn",
      message: "PRIVACY_COMPOSITION_DELTA_PRIME should lie strictly between 0 and 1 for analytic composition bookkeeping.",
    });
  }

  const rdpAlpha = Number(env.PRIVACY_RDP_ALPHA ?? 8);
  if (!(rdpAlpha > 1)) {
    findings.push({
      code: "PRIVACY_RDP_ALPHA_ORDER",
      severity: "warn",
      message: "PRIVACY_RDP_ALPHA must be strictly greater than 1 for Mironov Laplace RDP bookkeeping.",
    });
  }

  const rdpDelta = Number(env.PRIVACY_RDP_REPORT_DELTA ?? 1e-5);
  if (!(rdpDelta > 0 && rdpDelta < 1)) {
    findings.push({
      code: "PRIVACY_RDP_REPORT_DELTA_RANGE",
      severity: "warn",
      message: "PRIVACY_RDP_REPORT_DELTA should lie strictly between 0 and 1 when interpreting RDP conversions.",
    });
  }

  const clipMin = Number(env.DP_CLIP_MIN ?? 0);
  const clipMax = Number(env.DP_CLIP_MAX ?? 100);
  if (!(Number.isFinite(clipMin) && Number.isFinite(clipMax) && clipMin < clipMax)) {
    findings.push({
      code: "DP_CLIP_RANGE_INVALID",
      severity: "error",
      message: "DP_CLIP_MIN must be lower than DP_CLIP_MAX so mean sensitivity is well-defined.",
    });
  }

  const epsilonPerQuery = Number(env.DP_EPSILON_PER_QUERY ?? 0.5);
  const dailyCap = Number(env.PRIVACY_EPSILON_DAILY_CAP ?? 4);
  if (!(epsilonPerQuery > 0 && dailyCap >= epsilonPerQuery)) {
    findings.push({
      code: "PRIVACY_EPSILON_BUDGET_INVALID",
      severity: "error",
      message: "DP_EPSILON_PER_QUERY must be positive and no larger than PRIVACY_EPSILON_DAILY_CAP.",
    });
  }

  if (env.NODE_ENV === "production") {
    const demoPw = env.SHOWCASE_DEMO_PASSWORD ?? "";
    if (!demoPw || demoPw === "showcase") {
      findings.push({
        code: "SHOWCASE_PASSWORD_DEFAULT",
        severity: "warn",
        message: "Production deployments must rotate SHOWCASE_DEMO_PASSWORD away from demo defaults.",
      });
    }

    if (!env.ALLOWED_ORIGINS) {
      findings.push({
        code: "ALLOWED_ORIGINS_UNSET",
        severity: "warn",
        message: "Production browser ingest should set ALLOWED_ORIGINS to reduce cross-origin abuse paths.",
      });
    }

    if ((env.DATABASE_URL ?? "").startsWith("file:")) {
      findings.push({
        code: "SQLITE_IN_PRODUCTION",
        severity: "warn",
        message: "Production deployments should use managed Postgres or an equivalent operational database.",
      });
    }
  }

  const hasErrors = findings.some((f) => f.severity === "error");
  return { ok: !hasErrors, findings };
}
