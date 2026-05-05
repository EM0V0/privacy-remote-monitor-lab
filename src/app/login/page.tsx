import Link from "next/link";

import { ClinicalNotice } from "@/components/clinical-notice";

import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in",
  description:
    "Session gate for the remote monitoring lab demo — replace with OIDC for regulated deployments.",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">
        Demo identities use bcrypt-hashed passwords and signed HttpOnly JWT sessions — swap for OIDC / SAML and
        opaque server sessions when targeting regulated deployments.
      </p>
      <div className="mt-4 rounded-lg border border-dashed border-teal-200 bg-teal-50/60 px-3 py-2 text-xs text-teal-900">
        <p className="font-semibold">Seeded accounts</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>
            <code className="rounded bg-white/80 px-1">clinician@demo.local</code> · role CLINICIAN
          </li>
          <li>
            <code className="rounded bg-white/80 px-1">patient@demo.local</code> · role PATIENT
          </li>
        </ul>
        <p className="mt-2 text-teal-800">
          Password matches <code className="rounded bg-white/80 px-1">SHOWCASE_DEMO_PASSWORD</code> (default{" "}
          <code className="rounded bg-white/80 px-1">showcase</code>) after <code className="rounded bg-white/80 px-1">npm run db:seed</code>.
        </p>
      </div>
      <div className="mt-6">
        <ClinicalNotice variant="intendedUse" compact />
      </div>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoginForm />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/" className="text-teal-700 underline-offset-4 hover:underline">
          ← Back to overview
        </Link>
      </p>
    </div>
  );
}
