# Privacy-aware Remote Monitoring Lab (Scheme A)

Lightweight **Next.js** stack for **home / remote monitoring & trends** only (not autonomous diagnosis). SaMD-oriented labeling narrative without claiming certification or formal differential-privacy product guarantees.

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
| Privacy | **k-threshold**, **Laplace DP mean**, **ε-day budget ledger**, cryptographic noise sampling |

## Quick start

```powershell
copy .env.example .env
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
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
| GET | `/api/v1/analytics/private-aggregate` | Clinician session cookie — snapshot (**no ε spend**): drift, CUSUM flag, budget, latest audited DP release |
| POST | `/api/v1/analytics/private-aggregate` | Clinician session cookie — **Laplace mean release** (spends ε; same as dashboard button) |
| POST | `/api/v1/observations` | `Authorization: Bearer <INGEST_SECRET>` — body `{ "score": number, "recordedAt?" : ISO date }` |

### Privacy & algorithm tuning (optional `.env`)

| Variable | Default | Role |
|----------|---------|------|
| `PRIVACY_K_MIN` | `10` | Minimum cohort size before DP mean is allowed |
| `DP_EPSILON_PER_QUERY` | `0.5` | ε per Laplace release |
| `PRIVACY_EPSILON_DAILY_CAP` | `4` | Rolling 24h ε cap (ledger sums spends) |
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
| `npm run test` | Vitest — EWMA / CUSUM / drift / Laplace / insight wiring |
| `npm run db:push` | Apply schema to SQLite |
| `npm run db:seed` | Reseed users + synthetic observations |

## Production notes

- Move to managed **Postgres** (`DATABASE_URL`) and `prisma migrate`.
- Set strong **`SESSION_SECRET`** and **`INGEST_SECRET`** (≥16 characters); never ship defaults.
- Replace JWT demo auth with **OIDC/SAML**, MFA, and centralized session revocation as required by your QMS.
- Extend **audit export** (SIEM, WORM storage) and **edge rate limiting** where appropriate.
- DP releases use **crypto-grade uniform** draws for Laplace noise (not `Math.random()`).
- Formal DP guarantees require full **privacy ledger**, query class bookkeeping, and careful composition theorems — treat this repo as a **methods demonstration**.
