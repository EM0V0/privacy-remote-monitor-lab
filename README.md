# Privacy-aware Remote Monitoring Lab (Scheme A)

**Purpose — three sentences**

1. This lab demonstrates **remote monitoring over time-series telemetry** (e.g. wearable-derived scores) under explicit **non-diagnostic** labeling — it does **not** diagnose, triage, or prescribe.
2. It couples **EWMA / Page–CUSUM / robust drift** visual analytics with **governed differential privacy** (Laplace cohort mean, ε ledger, analytic composition + optional RDP gate) and **tamper-evident audit hashing**.
3. **Regression coverage** spans algorithms, privacy primitives, ledger/RDP provenance fields, and **Playwright smoke tests** for role separation; formal certifications and diagnostic AI claims stay **out of scope** — see **[docs/CONTRIBUTION.md](./docs/CONTRIBUTION.md)**.

Implementation detail (stack tables, env knobs, endpoints) follows below; STRIDE mapping lives in **[docs/THREAT_MODEL_STRIDE.md](./docs/THREAT_MODEL_STRIDE.md)**.

## Stack

| Layer | Choice |
|--------|--------|
| Framework | **Next.js 15** (App Router, React Server Components) |
| Language | **TypeScript** |
| UI | **Tailwind CSS** |
| Charts | **Recharts** |
| ORM / DB | **Prisma 5** + **SQLite** (swap Postgres for production) |
| Session | **HttpOnly JWT** (HS256, `SESSION_SECRET`) — replace with opaque sessions / OIDC where required |
| Validation | **Zod** on login + ingestion API |
| Passwords | **bcrypt** (seeded demo users only) |
| Algorithms | **EWMA** smoothing, **Page–CUSUM** shifts, **MAD robust drift** (heuristic thresholds) |
| Privacy | **k-threshold**, **Laplace DP mean**, **ε ledger**, **advanced composition**, **Mironov Laplace RDP sums + conversion**, optional **RDP gate**, **Warner RR helper** (`local-dp.ts`), cryptographic uniforms |

## Quick start

```powershell
copy .env.example .env
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

**Windows:** If `npm install` fails with Prisma `EPERM` renaming `query_engine-windows.dll.node`, run `npm install --ignore-scripts`, close locking apps, then `npx prisma generate`.

**E2E smoke tests** (after seed + build):

```powershell
npm run build
npx playwright install chromium
npm run test:e2e
```

Open [http://localhost:3000](http://localhost:3000) → **Open demo dashboard**.

**Seeded accounts** (password = `SHOWCASE_DEMO_PASSWORD`, default `showcase`):

- `clinician@demo.local` — audit strip, **EWMA / CUSUM / drift panel**, explicit **DP mean release** (ε ledger)  
- `patient@demo.local` — chart overlays only (no cohort DP release controls)

Change `.env` passwords and **re-run seed** so hashes stay aligned.

## HTTP endpoints

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | Liveness JSON |
| GET | `/api/v1/analytics/private-aggregate` | Clinician session cookie — snapshot (**no ε spend**): drift, CUSUM flag, linear ε ledger pressure, advanced-composition preview, RDP bookkeeping (`privacyAccounting`), latest audited DP release |
| GET | `/api/v1/admin/audit-chain` | **`Authorization: Bearer <ADMIN_AUDIT_SECRET>`** — JSON output from `verifyAuditChainIntegrity()` (503 if secret unset / too short) |
| POST | `/api/v1/analytics/private-aggregate` | Clinician session cookie — **Laplace mean release** (spends ε; same as dashboard button) |
| POST | `/api/v1/observations` | `Authorization: Bearer <INGEST_SECRET>` — body `{ "score": number, "recordedAt?" : ISO date }` |

### Privacy & algorithm tuning (optional `.env`)

| Variable | Default | Role |
|----------|---------|------|
| `PRIVACY_K_MIN` | `10` | Minimum cohort size before DP mean is allowed |
| `DP_EPSILON_PER_QUERY` | `0.5` | ε per Laplace release |
| `PRIVACY_EPSILON_DAILY_CAP` | `4` | Rolling 24h ε cap (ledger sums spends) |
| `PRIVACY_EPSILON_COMPOSITION_CAP` | mirrors daily cap | Caps analytic homogeneous advanced-composition surrogate |
| `PRIVACY_COMPOSITION_DELTA_PRIME` | `1e-6` | Slack δ′ in √(2k ln(1/δ′)) bookkeeping |
| `PRIVACY_RDP_ALPHA` | `8` | Renyi order α for Laplace RDP curve bookkeeping |
| `PRIVACY_RDP_REPORT_DELTA` | `1e-5` | δ anchor when converting summed RDP into a reported ε upper bound |
| `PRIVACY_ENABLE_RDP_GATE` | `false` | Set `1`/`true` to enforce Mironov conversion vs `PRIVACY_EPSILON_COMPOSITION_CAP` |
| `LOGIN_RATE_LIMIT_PER_MIN` | `45` | Server-action login attempts per rolling minute bucket |
| `INGEST_RATE_LIMIT_PER_MIN` | `240` | Observation ingest attempts per client IP minute bucket |
| `ALLOWED_ORIGINS` | *(empty)* | Optional comma-separated Origin allowlist for browser POST `/api/v1/observations` |
| `ADMIN_AUDIT_SECRET` | *(unset)* | ≥16 chars enables `GET /api/v1/admin/audit-chain` Bearer verification |
| `DP_CLIP_MIN` / `DP_CLIP_MAX` | `0` / `100` | Clipping bounds (sensitivity for mean mechanism) |
| `EWMA_LAMBDA` | `0.25` | EWMA smoothing factor |
| `CUSUM_SLACK` | `0.35` | CUSUM slack `k` on standardized residuals |
| `CUSUM_THRESHOLD` | `4` | CUSUM decision interval `h` |
| `DRIFT_RECENT_WINDOW` | `12` | Recent window length (points) |
| `DRIFT_Z_THRESHOLD` | `1.25` | Robust median drift flag threshold |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run lint` | ESLint (Next.js) |
| `npm run build` | `prisma generate` + production build |
| `npm run test` | Vitest — algorithms / Laplace / DP composition / Mironov RDP / ledger integration / audit chains / compliance hints |
| `npm run test:e2e` | Playwright smoke — role gates + `/api/health` (requires `npm run build` first locally; CI builds automatically) |
| `npm run audit:verify` | Runs `verifyAuditChainIntegrity()` via `tsx` (uses `DATABASE_URL`; set `AUDIT_VERIFY_STRICT=1` to fail when hashes are missing) |
| `npm run db:push` | Apply schema to SQLite |
| `npm run db:seed` | Reseed users + synthetic observations |

## Academic security posture (honest scope)

- **Implemented in-repo:** dual mandatory privacy gates (linear ledger + homogeneous advanced-composition surrogate), Mironov Laplace RDP sums + optional conversion gate (`src/lib/privacy/rdp.ts`), ingest/login rate buckets, optional Origin tightening for browser ingest, SHA-256 audit hash chains (`src/lib/audit-hash.ts`), lightweight runtime compliance hints (`src/lib/compliance/env-self-check.ts`), local DP Warner helpers for wearable-style narratives.
- **Documented deferred work:** mTLS, hardware-backed identities, heterogeneous RDP accountants with full query-class metadata, MPC / federated analytics, external immutable anchoring (WORM / third-party notaries), automated HIPAA/GDPR/FDA evidence packs, and machine-checked proofs (EasyCrypt / F\*).
- See **[docs/THREAT_MODEL_STRIDE.md](./docs/THREAT_MODEL_STRIDE.md)** for a STRIDE table aligned with publication reviewers.

## Production notes

- Move to managed **Postgres** (`DATABASE_URL`) and `prisma migrate`.
- Set strong **`SESSION_SECRET`** and **`INGEST_SECRET`** (≥16 characters); never ship defaults.
- Replace JWT demo auth with **OIDC/SAML**, MFA, and centralized session revocation as required by your QMS.
- Extend **audit export** (SIEM, WORM storage) and **edge rate limiting** where appropriate.
- Call **`verifyAuditChainIntegrity()`** (`src/lib/audit.ts`) after restores/migrations to prove tamper-evident sequencing before legal holds.
- Legacy audits authored **before** enabling hash chaining lack seals — truncate/export those partitions before enforcing verification.
- Run **`evaluateRuntimeCompliance()`** (`src/lib/compliance/env-self-check.ts`) from CI or bootstrap scripts — configuration linting only, not certification.
- DP releases use **crypto-grade uniform** draws for Laplace noise (not `Math.random()`).
- Formal DP guarantees require full **privacy ledger taxonomy**, heterogeneous accountants (RDP/zCDP), and optional proof assistants — treat advanced composition here as an **analytic governance helper**, not end-to-end verified privacy for arbitrary pipelines.
