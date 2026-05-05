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
 * Lightweight configuration sanity checks for demos — not a HIPAA/GDPR certification harness.
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

  if (env.NODE_ENV === "production") {
    const demoPw = env.SHOWCASE_DEMO_PASSWORD ?? "";
    if (!demoPw || demoPw === "showcase") {
      findings.push({
        code: "SHOWCASE_PASSWORD_DEFAULT",
        severity: "warn",
        message: "Production deployments must rotate SHOWCASE_DEMO_PASSWORD away from demo defaults.",
      });
    }
  }

  const hasErrors = findings.some((f) => f.severity === "error");
  return { ok: !hasErrors, findings };
}
