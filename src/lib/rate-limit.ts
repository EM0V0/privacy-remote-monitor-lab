import { prisma } from "@/lib/prisma";

const MINUTE_MS = 60_000;

function currentWindowId(): number {
  return Math.floor(Date.now() / MINUTE_MS);
}

/**
 * Fixed-window counter stored in SQLite — best-effort abuse throttle for demo deployments.
 */
export async function incrementRateLimit(params: {
  routeKey: string;
  maxPerWindow: number;
}): Promise<{ ok: boolean; count: number }> {
  const windowId = currentWindowId();

  const row = await prisma.rateLimitBucket.upsert({
    where: {
      routeKey_windowId: {
        routeKey: params.routeKey,
        windowId,
      },
    },
    create: {
      routeKey: params.routeKey,
      windowId,
      count: 1,
    },
    update: {
      count: { increment: 1 },
    },
  });

  const ok = row.count <= params.maxPerWindow;
  return { ok, count: row.count };
}
