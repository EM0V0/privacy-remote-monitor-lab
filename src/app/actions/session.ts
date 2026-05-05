"use server";

import { headers } from "next/headers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAudit } from "@/lib/audit";
import { hashClientIpHint } from "@/lib/ip-hint";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { readPrivacyEnv } from "@/lib/privacy/budget";
import { incrementRateLimit } from "@/lib/rate-limit";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
} from "@/lib/session-jwt";

export type SessionMessage = { message: string | null };

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(256),
});

const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 8;

export async function loginAction(
  _prevState: SessionMessage,
  formData: FormData,
): Promise<SessionMessage> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { message: "Enter a valid email and password." };
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;

  const privacyEnv = readPrivacyEnv();
  const rl = await incrementRateLimit({
    routeKey: `login:${email}`,
    maxPerWindow: privacyEnv.loginRateLimitPerMinute,
  });
  if (!rl.ok) {
    return {
      message: "Too many sign-in attempts this minute. Slow down and retry shortly.",
    };
  }

  const hdrs = await headers();
  const ipHint = hashClientIpHint(hdrs);

  const since = new Date(Date.now() - LOGIN_FAILURE_WINDOW_MS);
  const recentFailures = await prisma.auditEvent.count({
    where: {
      eventType: "LOGIN_FAILURE",
      subject: email,
      createdAt: { gte: since },
    },
  });

  if (recentFailures >= MAX_LOGIN_FAILURES) {
    await writeAudit({
      eventType: "LOGIN_FAILURE",
      subject: email,
      metadata: { reason: "rate_limited", ipHint },
    });
    return {
      message: "Too many sign-in attempts for this account. Try again later.",
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await writeAudit({
      eventType: "LOGIN_FAILURE",
      subject: email,
      metadata: { reason: "unknown_user", ipHint },
    });
    return { message: "Invalid email or password." };
  }

  const ok = await verifyPassword(password, user.passwordHash);

  if (!ok) {
    await writeAudit({
      eventType: "LOGIN_FAILURE",
      actorId: user.id,
      subject: email,
      metadata: { reason: "bad_password", ipHint },
    });
    return { message: "Invalid email or password." };
  }

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === "production",
  });

  await writeAudit({
    eventType: "LOGIN_SUCCESS",
    actorId: user.id,
    subject: email,
    metadata: { ipHint },
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const claims = raw ? await verifySessionToken(raw) : null;

  if (claims) {
    await writeAudit({
      eventType: "LOGOUT",
      actorId: claims.sub,
      subject: claims.email,
    });
  }

  jar.delete(SESSION_COOKIE_NAME);
  redirect("/");
}
