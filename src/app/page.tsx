import Link from "next/link";

import { ClinicalNotice } from "@/components/clinical-notice";

export const metadata = {
  title: "Home",
  description:
    "Privacy-aware remote monitoring lab (Scheme A). Monitoring & trends only; EWMA/CUSUM drift cues and clinician-triggered DP cohort summaries.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
            Scheme A · SaMD-oriented UX narrative
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
            Privacy-aware remote monitoring lab
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            A fresh, lightweight stack for{" "}
            <strong className="font-semibold text-slate-800">home & remote trend visualization</strong>
            — built with{" "}
            <strong className="font-semibold text-slate-800">
              Next.js 15, React 19, Tailwind, Prisma, SQLite, Recharts
            </strong>
            . Swap SQLite for Postgres and add enterprise identity when you harden for submission.
          </p>
        </div>

        <ClinicalNotice variant="intendedUse" />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Security posture (demo-grade)</h2>
          <ul className="mt-4 list-inside list-disc space-y-2 text-slate-600">
            <li>
              <strong className="text-slate-800">Hashed credentials</strong> — bcrypt at rest; JWT in HttpOnly cookie
              with rotation-friendly secrets.
            </li>
            <li>
              <strong className="text-slate-800">Audit trail</strong> — append-only events for sign-in and API ingest
              (clinician-visible strip).
            </li>
            <li>
              <strong className="text-slate-800">Ingress validation</strong> — Zod schemas + Bearer gate on telemetry
              POST.
            </li>
            <li>
              <strong className="text-slate-800">Baseline headers</strong> — frame denial, nosniff, strict referrer,
              trimmed permissions policy.
            </li>
            <li>
              <strong className="text-slate-800">Monitoring analytics</strong> — EWMA trend damping, Page–CUSUM shift
              cues, MAD-normalized drift probes (thresholds are configurable research knobs).
            </li>
            <li>
              <strong className="text-slate-800">Privacy accounting</strong> — Laplace mechanism on clipped cohort
              means with k-threshold gating, rolling ε budget ledger, and clinician-triggered releases only.
            </li>
          </ul>
        </section>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-teal-800"
          >
            Open demo dashboard
          </Link>
          <a
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-800 hover:bg-slate-50"
          >
            Next.js docs
          </a>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Why this stack</h2>
          <ul className="mt-4 list-inside list-disc space-y-2 text-slate-600">
            <li>
              <strong className="text-slate-800">Type-safe full stack</strong> — shared models via Prisma,
              server components for data access.
            </li>
            <li>
              <strong className="text-slate-800">Fast iteration</strong> — file-based routing and a browser-first loop
              without shipping separate native clients for early UX validation.
            </li>
            <li>
              <strong className="text-slate-800">Deployability</strong> — fits Vercel / Node hosts; move DB to
              Neon or RDS for production.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
