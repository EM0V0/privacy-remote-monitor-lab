import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { incrementRateLimit } from "@/lib/rate-limit";

const routeKeys: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)("incrementRateLimit", () => {
  afterEach(async () => {
    if (routeKeys.length > 0) {
      await prisma.rateLimitBucket.deleteMany({ where: { routeKey: { in: [...routeKeys] } } });
      routeKeys.length = 0;
    }
  });

  it("allows requests up to the fixed-window cap and blocks the next one", async () => {
    const routeKey = `__vitest_rate_limit_${Date.now()}__`;
    routeKeys.push(routeKey);

    await expect(incrementRateLimit({ routeKey, maxPerWindow: 2 })).resolves.toEqual({
      ok: true,
      count: 1,
    });
    await expect(incrementRateLimit({ routeKey, maxPerWindow: 2 })).resolves.toEqual({
      ok: true,
      count: 2,
    });
    await expect(incrementRateLimit({ routeKey, maxPerWindow: 2 })).resolves.toEqual({
      ok: false,
      count: 3,
    });
  });
});
