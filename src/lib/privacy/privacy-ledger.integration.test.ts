import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";

const TEST_QUERY = "__vitest_privacy_ledger_mechanism__";

describe.skipIf(!process.env.DATABASE_URL)("PrivacyLedger mechanism & renyiOrder (integration)", () => {
  afterAll(async () => {
    await prisma.privacyLedger.deleteMany({ where: { queryType: TEST_QUERY } });
  });

  it("persists explicit mechanism and Renyi order columns", async () => {
    const created = await prisma.privacyLedger.create({
      data: {
        epsilon: 0.25,
        delta: 0,
        mechanism: "laplace_mean",
        renyiOrder: 16,
        queryType: TEST_QUERY,
        metadata: JSON.stringify({ probe: true }),
      },
    });

    expect(created.mechanism).toBe("laplace_mean");
    expect(created.renyiOrder).toBe(16);

    const fetched = await prisma.privacyLedger.findUnique({ where: { id: created.id } });
    expect(fetched?.mechanism).toBe("laplace_mean");
    expect(fetched?.renyiOrder).toBe(16);

    await prisma.privacyLedger.delete({ where: { id: created.id } });
  });
});
