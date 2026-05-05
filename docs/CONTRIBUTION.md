# Contribution thesis & verification scope

This file states **what this repository is allowed to claim**, how it is **tested**, and what sits **outside** the proof boundary. Use it for capstone grading, reviewer responses, and QMS-adjacent honesty checks.

## One-line thesis

**Demonstrate privacy-governed remote monitoring analytics** (trend / shift detection + explicit differential-privacy cohort releases) with **audit-grade integrity hooks**, without asserting diagnostic SaMD behavior.

## Explicit non-goals (do not claim in papers or UI)

- **No autonomous diagnosis or treatment recommendations.** Monitoring overlays are **exploratory signals** only.
- **No FDA / HIPAA / GDPR certification** from this codebase. Compliance helpers are **configuration linting**, not attestations.
- **No machine-checked DP proofs.** Composition / RDP helpers are **documented analytic bookkeeping** unless you add external formal verification artifacts.

## What is scientifically “wired in” vs illustrative

| Area | Role in-repo |
|------|----------------|
| EWMA / Page–CUSUM / MAD drift | Implemented deterministic algorithms with Vitest regressions — thresholds are **demo knobs**, not clinically calibrated. |
| Laplace mean release | Crypto-grade uniforms → Laplace noise; **ε ledger + dual gates** (linear cap + advanced composition surrogate); optional **RDP conversion gate**. |
| Renyi bookkeeping | Mironov Laplace Table-II curve + conversion lemma — ledger rows record **`mechanism` / `renyiOrder`** for provenance. |
| Audit trail | Append-only events + **SHA-256 hash chain** over canonical payloads (`audit-hash.ts`); CLI/API verification helpers. |
| Abuse hygiene | Login / ingest rate buckets; optional Origin tightening on browser ingest posts. |

## Test pyramid (what runs in CI)

1. **Static:** `next lint`, `prisma validate`, `tsc` alignment via Next build.
2. **Unit / property-lite:** Vitest over algorithms, DP primitives, composition/RDP, ledger-Renyi resolver, audit hash verification, env compliance hints.
3. **Integration:** One Prisma-backed ledger migration probe (`privacy-ledger.integration.test.ts`) when `DATABASE_URL` is set.
4. **E2E smoke:** Playwright asserts **role separation** — patient cannot access clinician DP release UI; clinician sees release control; `/api/health` responds.

## What tests deliberately do **not** cover

- Clinical validity, ROC, or calibration studies.
- Penetration testing / full OWASP coverage (manual ZAP or vendor scans are out of scope here).
- Federated learning, LLM multi-agent diagnosis, or foundation-model training pipelines — thesis chapters only unless you add new services.

## Threat modeling pointer

See [THREAT_MODEL_STRIDE.md](./THREAT_MODEL_STRIDE.md) for STRIDE mapping and deferred hardening items.

## Maintainer checklist before tagging a release

- `npm run lint` / `npm run test` / `npm run build` green locally.
- `npm run test:e2e` green against a seeded database (`prisma db push && prisma db seed`).
- `npm run audit:verify` (optionally `AUDIT_VERIFY_STRICT=1` once every audit row carries hashes).
