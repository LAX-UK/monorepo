import { test } from "@playwright/test";
import {
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  e2eSkipReason,
  gotoAdminPath,
} from "./helpers/auth";
import { observeLayoutShift } from "./helpers/motion-check";
import {
  expectStaffOverlaysCalm,
  expectStaffOverlaysStillUnderReducedMotion,
} from "./helpers/overlay-motion";

// Opt-in with the other motion checks: `pnpm --filter @auction/web test:e2e:motion`.
test.describe("overlay motion on Bid admin @optin", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  const targets = (page: import("@playwright/test").Page) => ({
    menuTrigger: page.getByRole("button", { name: /^Account:/ }),
    dialogTrigger: page.getByRole("button", { name: "Search pages and records" }),
  });

  test("a menu and a dialog open calmly and quickly", async ({ page }) => {
    await observeLayoutShift(page);
    await gotoAdminPath(page, "/admin");
    await dismissStaffPaletteIfOpen(page);
    await page.waitForLoadState("networkidle");
    await expectStaffOverlaysCalm(page, targets(page));
  });

  test("they move nothing under reduced motion", async ({ page }) => {
    await gotoAdminPath(page, "/admin");
    await dismissStaffPaletteIfOpen(page);
    await page.waitForLoadState("networkidle");
    await expectStaffOverlaysStillUnderReducedMotion(page, targets(page));
  });
});
