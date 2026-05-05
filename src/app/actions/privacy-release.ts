"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { releasePrivateMean } from "@/lib/privacy/private-release";
import { getSession } from "@/lib/session";

/**
 * Clinician-only server action: spends ε from the daily budget and logs a Laplace mean release.
 */
export async function releaseDpAggregateAction() {
  const session = await getSession();
  if (!session || session.role !== "CLINICIAN") {
    redirect("/login");
  }

  const rows = await prisma.observation.findMany({
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { score: true },
  });
  const scores = rows.map((r) => r.score);

  const result = await releasePrivateMean({ scores, actorId: session.sub });
  if (!result.ok) {
    redirect(`/dashboard?privacyErr=${encodeURIComponent(result.detail)}`);
  }

  redirect("/dashboard");
}
