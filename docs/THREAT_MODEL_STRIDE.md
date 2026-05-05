# STRIDE threat modeling — MeDUSA lab scope

This document maps the demo codebase to the STRIDE categories so reviewers can see **what is implemented today**, what remains **aspirational research**, and where formal guarantees would require additional tooling (e.g., EasyCrypt, RDP accountants, HSM-backed identities).

## Trust boundaries

1. **Browser clinician UI** → Next.js server actions / Route Handlers (JWT cookie session).
2. **Telemetry client / gateway** → `POST /api/v1/observations` (Bearer `INGEST_SECRET`).
3. **SQLite database** → stores PHI-light demo telemetry, audit rows, privacy ledger, rate-limit buckets.

Zero-trust production deployments would shrink each boundary with device-bound credentials, short-lived tokens, continuous verification, and centralized policy — see README production notes.

## STRIDE walk-through

| Category | Risk focus | Current mitigations (demo) | Deferred / research-grade hardening |
|----------|------------|---------------------------|-------------------------------------|
| **Spoofing** | Fake clinician session or forged ingest | HttpOnly JWT (`SESSION_SECRET`), bcrypt passwords, Bearer ingest secret | mTLS, hardware-backed keys, OAuth2/OIDC, device attestation |
| **Tampering** | Modified payloads / audit rows | Zod validation on login & ingest; Prisma ORM; **SHA-256 audit hash chains** (`audit-hash.ts`) over canonical JSON payloads | Distributed witnesses, WORM-only writers, Merkle batching / blockchain anchoring |
| **Repudiation** | Actor denies releasing aggregates | Append-only `auditEvent` rows, structured `PRIVACY_RELEASE` metadata, **`verifyAuditChainIntegrity()`** helper | Non-repudiation via asymmetric signatures, centralized timestamp authorities |
| **Information disclosure** | Over-sharing aggregates / leakage via APIs | k-threshold, clipping, Laplace mechanism, ε ledger + **dual mandatory gates** + **Mironov Laplace RDP sums/conversion** (`rdp.ts`) | Field-level encryption, KMS, heterogeneous RDP accountants with query-class metadata |
| **Denial of service** | Brute login / ingest floods | Per-route rolling counters in `RateLimitBucket`; optional `ALLOWED_ORIGINS` guard on browser-origin ingest posts | WAF, edge rate limiting, autoscaling, CAPTCHA |
| **Elevation of privilege** | Patient triggers clinician DP tooling | Role checks in session helpers & APIs | ABAC, dynamic policy engine, separation of duties |

## Operational assumptions & honesty clauses

- **JWT sessions are convenient, not zero-trust.** Refresh splitting, impossible-travel analytics, and hardware-backed challenges are roadmap items, not shipped features.
- **Advanced composition helper** implements the homogeneous analytic bound documented in `advanced-composition.ts`. Adaptive heterogeneous releases need richer accountants — citing “advanced composition” alone is **not** a formal end-to-end DP proof for arbitrary pipelines.
- **Rate-limit buckets** are keyed per minute; operational hygiene should prune old windows or move counters to Redis in multi-instance deployments.
- **`ALLOWED_ORIGINS`** narrows browser-post abuse but does not replace authenticated federation models for third-party gateways.

## How this supports publication narratives

Use this file to anchor claims in papers or theses: point reviewers to concrete paths (`src/lib/privacy/*`, `src/middleware.ts`, audit writers) and clearly label future contributions (e.g., machine-checked Laplace proofs, RDP ledgers, MPC cohort analytics).

## Suggested next experiments (aligned with academic roadmap)

1. **Heterogeneous RDP / zCDP ledger** — extend the fixed-α Laplace sums in `rdp.ts` with query-class-specific ρ schedules and adaptive α selection (beyond the demo’s homogeneous Laplace releases).
2. **Behavioral biometrics / zero-trust session risk scoring** — tie anomalies to step-up auth before DP releases.
3. **Immutable audit exports** — periodic signed checkpoints plus external SIEM replication (optional blockchain anchoring if your institution encourages it).
4. **Formal verification** — reproduce Laplace ε-DP statements in EasyCrypt / Probabilistic Relational Hoare logic as supplementary artifact material.

Maintainers should revise this document whenever trust boundaries or controls materially change.
