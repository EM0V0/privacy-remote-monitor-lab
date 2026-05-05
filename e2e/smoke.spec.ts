import { expect, test } from "@playwright/test";

/** Matches seeded demo password unless overridden in CI (SHOWCASE_DEMO_PASSWORD). */
const demoPassword = process.env.E2E_DEMO_PASSWORD ?? "showcase";

test.describe("Smoke — monitoring lab gates", () => {
  test("health endpoint returns success", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
  });

  test("patient session never mounts clinician DP release tooling", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("patient@demo.local");
    await page.getByTestId("login-password").fill(demoPassword);
    await page.getByTestId("login-submit").click();

    await expect(page.getByRole("heading", { name: "Monitoring dashboard" })).toBeVisible();
    await expect(page.locator('[data-testid="privacy-algorithm-panel"]')).toHaveCount(0);
    await expect(page.getByTestId("patient-dp-placeholder")).toBeVisible();
  });

  test("clinician session exposes cohort DP release control", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("clinician@demo.local");
    await page.getByTestId("login-password").fill(demoPassword);
    await page.getByTestId("login-submit").click();

    await expect(page.getByRole("heading", { name: "Monitoring dashboard" })).toBeVisible();
    await expect(page.getByTestId("privacy-algorithm-panel")).toBeVisible();
    await expect(page.getByTestId("dp-release-submit")).toBeVisible();
  });
});
