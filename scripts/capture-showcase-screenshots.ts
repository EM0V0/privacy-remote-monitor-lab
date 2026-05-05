import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, expect, type Page } from "@playwright/test";

const root = process.cwd();
const outDir = path.join(root, "docs", "screenshots");
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const demoPassword = process.env.E2E_DEMO_PASSWORD ?? process.env.SHOWCASE_DEMO_PASSWORD ?? "showcase";

function commandArgs(command: string, args: string[]) {
  if (process.platform !== "win32") return { command, args };
  return { command: "cmd.exe", args: ["/c", `${command}.cmd`, ...args] };
}

function run(command: string, args: string[]) {
  const resolved = commandArgs(command, args);
  execFileSync(resolved.command, resolved.args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseURL}/api/health`);
      if (res.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become ready at ${baseURL}`);
}

function stopServer(server: ChildProcessWithoutNullStreams) {
  if (!server.pid) return;
  if (process.platform === "win32") {
    execFileSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
}

async function login(page: Page, email: string) {
  await page.goto(`${baseURL}/login`);
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(demoPassword);
  await page.getByTestId("login-submit").click();
  await expect(page.getByRole("heading", { name: "Monitoring dashboard" })).toBeVisible();
}

async function clickRelease(page: Page) {
  await page.getByTestId("dp-release-submit").click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(350);
}

async function main() {
  await mkdir(outDir, { recursive: true });

  run("npx", ["prisma", "db", "seed"]);

  const start = commandArgs("npm", ["run", "start"]);
  const server = spawn(start.command, start.args, {
    cwd: root,
    env: process.env,
    stdio: "pipe",
  });

  server.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));

  try {
    await waitForServer();

    const browser = await chromium.launch();
    try {
      const patientContext = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
      const patientPage = await patientContext.newPage();
      await login(patientPage, "patient@demo.local");
      await patientPage.screenshot({
        path: path.join(outDir, "patient-dashboard.png"),
        fullPage: true,
      });
      await patientContext.close();

      const clinicianContext = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
      const clinicianPage = await clinicianContext.newPage();
      await login(clinicianPage, "clinician@demo.local");
      await clickRelease(clinicianPage);
      await expect(clinicianPage.getByText("Evidence:")).toBeVisible();
      await clinicianPage.screenshot({
        path: path.join(outDir, "clinician-release-evidence.png"),
        fullPage: true,
      });

      for (let i = 0; i < 8; i += 1) {
        await clickRelease(clinicianPage);
      }
      await expect(clinicianPage.locator('p[role="alert"]').first()).toBeVisible();
      await clinicianPage.screenshot({
        path: path.join(outDir, "denied-release-audit.png"),
        fullPage: true,
      });
      await clinicianContext.close();
    } finally {
      await browser.close();
    }
  } finally {
    stopServer(server);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
