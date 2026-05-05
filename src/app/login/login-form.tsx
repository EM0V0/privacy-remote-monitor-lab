"use client";

import { useActionState } from "react";

import { loginAction } from "@/app/actions/session";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, { message: null });

  return (
    <form action={formAction} data-testid="login-form" className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          data-testid="login-email"
          className="rounded-lg border border-slate-300 px-3 py-2 text-base outline-none ring-teal-700 focus:ring-2"
          placeholder="clinician@demo.local"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          data-testid="login-password"
          className="rounded-lg border border-slate-300 px-3 py-2 text-base outline-none ring-teal-700 focus:ring-2"
          placeholder="Default: showcase (after seed)"
        />
      </label>
      {state.message ? (
        <p className="text-sm text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        data-testid="login-submit"
        className="rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
