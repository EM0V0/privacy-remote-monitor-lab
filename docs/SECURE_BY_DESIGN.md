# Secure-by-Design Posture

This project applies secure-by-design as an engineering posture, not as a certification claim.

Reference baseline: CISA's secure-by-design guidance emphasizes ownership of customer security outcomes, transparency/accountability, and safer defaults:

- https://www.cisa.gov/resources-tools/resources/secure-by-design
- https://www.cisa.gov/securebydesign

## Current Answer

Secure-by-design is partially implemented and now materially stronger than a normal demo.

The project has real controls in code:

| Principle | Current Control | Evidence |
| --- | --- | --- |
| Safe default | Patients cannot trigger cohort releases | `src/app/dashboard/page.tsx`, `e2e/smoke.spec.ts` |
| Least privilege | Clinician-only aggregate release route/action | `src/app/api/v1/analytics/private-aggregate/route.ts`, `src/app/actions/privacy-release.ts` |
| Privacy by default | Raw scores are not exported as cohort insight; releases require DP gates | `src/lib/privacy/private-release.ts` |
| Deny with evidence | Failed release attempts are recorded as denied evidence rows | `PrivacyRelease.status = denied`, `src/lib/privacy/private-release.test.ts` |
| Accountability | Successful and denied releases are audit-chain events | `src/lib/audit.ts`, `src/lib/audit-hash.ts` |
| Atomicity | Successful release ledger, audit event, and evidence row are written in one transaction | `src/lib/privacy/private-release.ts` |
| Input validation | Login and telemetry ingest validate input before persistence | `src/app/actions/session.ts`, `src/app/api/v1/observations/route.ts` |
| Abuse resistance | Login and ingest use coarse rate limits | `src/lib/rate-limit.ts` |
| Configuration hardening | Runtime self-check flags weak secrets, invalid DP bounds, and unsafe production posture | `src/lib/compliance/env-self-check.ts` |
| Transparency | Threat model and proof boundary are documented | `docs/THREAT_MODEL_STRIDE.md`, `docs/CONTRIBUTION.md` |

## What Is Not Yet Secure-by-Design Enough

The following are still deferred and should not be implied in papers, demos, or README copy:

- no MFA, OIDC/SAML, or centralized session revocation
- no field-level encryption or KMS-backed envelope encryption
- no consent lifecycle model yet
- no immutable external audit anchoring
- no SBOM or vulnerability management workflow in repo
- no production incident-response or breach-notification process
- no formal DP proof artifact
- no clinical safety case or FDA submission package

## Engineering Direction

The project should keep moving from "security feature demo" to "security evidence product":

1. Keep policy checks in server-side code, never only in UI.
2. Record both allowed and denied sensitive actions.
3. Make release evidence queryable and human-readable.
4. Add tests for every privacy gate.
5. Treat compliance language as traceability, not certification.
