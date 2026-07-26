import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type FullConfig, chromium } from "@playwright/test";
import {
  assertAuthenticatedStaffSession,
  clearAuthSignInRateLimits,
  e2eEnabled,
  hasStaffCredentials,
  staffLogin,
} from "./helpers/auth";

const authFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".auth",
  "staff-visual.json",
);

/** Seeds staff auth cookies once for admin visual baseline runs. */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  if (process.env.PLAYWRIGHT_VISUAL !== "1" || !e2eEnabled || !hasStaffCredentials()) {
    return;
  }

  clearAuthSignInRateLimits();

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
  });
  const page = await context.newPage();

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (attempt > 1) {
        clearAuthSignInRateLimits();
        await page.waitForTimeout(2_000);
      }
      await staffLogin(page);
      await assertAuthenticatedStaffSession(page);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    await browser.close();
    throw lastError;
  }

  await context.storageState({ path: authFile });
  await browser.close();
}

export { authFile as staffVisualAuthFile };
