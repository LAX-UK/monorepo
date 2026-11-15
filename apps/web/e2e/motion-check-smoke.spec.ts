import { expect, test } from "@playwright/test";
import {
  MOTION_BUDGETS,
  layoutShiftScore,
  measureInteractionToPaint,
  movingAnimations,
  observeLayoutShift,
  restingScreenshotParity,
  throttleCpu,
  useReducedMotion,
} from "./helpers/motion-check";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

// One smoke use of the motion check on Bid home; later motion PRs add their own interactions.
// Opt-in (not part of the PR gate): `pnpm --filter @auction/web test:e2e:motion`.
test.describe("motion check on Bid home @optin", () => {
  test.skip(!enabled, skipReason);

  test("settles without layout shift and answers a press within budget", async ({ page }) => {
    await observeLayoutShift(page);
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await layoutShiftScore(page)).toBeLessThanOrEqual(MOTION_BUDGETS.layoutShift);

    await throttleCpu(page);
    const link = page.locator("#main-content a[href]").first();
    const paintMs = await measureInteractionToPaint(page, () =>
      link.hover().then(() => page.mouse.down()),
    );
    await page.mouse.up();
    expect(paintMs).toBeLessThanOrEqual(MOTION_BUDGETS.interactionToPaintMs);
  });

  test("reduced motion leaves nothing moving", async ({ page }) => {
    await useReducedMotion(page);
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await movingAnimations(page)).toEqual([]);
  });

  test("the page at rest is the same without JavaScript", async ({ page }) => {
    await page.goto("/");
    const { withJs, withoutJs } = await restingScreenshotParity(page, "/");
    expect(withJs.equals(withoutJs)).toBe(true);
  });
});
