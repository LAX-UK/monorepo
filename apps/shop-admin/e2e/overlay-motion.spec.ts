import type { Page } from "@playwright/test";
import { observeLayoutShift } from "../../web/e2e/helpers/motion-check";
import {
  expectStaffOverlaysCalm,
  expectStaffOverlaysStillUnderReducedMotion,
} from "../../web/e2e/helpers/overlay-motion";
import { requireStaffAcceptanceCredentials } from "./support/staff-credentials.js";
import { openStaffBrowserSession } from "./support/staff-session.js";
import { expect, test } from "./support/test.js";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const authBaseUrl = process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid";

// The motion check is shared with Bid admin (apps/web/e2e/helpers); the staff shell is the same.
test.describe("overlay motion on LAX Admin @optin", () => {
  test.setTimeout(120_000);
  test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 against deployed shop-admin");

  const targets = (page: Page) => ({
    menuTrigger: page.getByRole("button", { name: /^Account:/ }),
    dialogTrigger: page.getByRole("button", { name: "Search pages and records" }),
  });

  async function openOverview(page: Page): Promise<void> {
    const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3030").replace(
      /\/+$/,
      "",
    );
    const credentials = requireStaffAcceptanceCredentials();
    const session = await openStaffBrowserSession({
      page,
      baseUrl,
      authBaseUrl,
      email: credentials.email,
      password: credentials.password,
      totpSecret: credentials.totpSecret,
    });
    await page.goto(`${session.baseUrl}/overview`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: /^Overview$/ })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle");
  }

  test("a menu and a dialog open calmly and quickly", async ({ page }) => {
    await observeLayoutShift(page);
    await openOverview(page);
    await expectStaffOverlaysCalm(page, targets(page));
  });

  test("they move nothing under reduced motion", async ({ page }) => {
    await openOverview(page);
    await expectStaffOverlaysStillUnderReducedMotion(page, targets(page));
  });
});
