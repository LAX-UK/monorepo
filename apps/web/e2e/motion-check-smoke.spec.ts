import { expect, test } from "@playwright/test";
import {
  MOTION_BUDGETS,
  RESTING_PARITY_MAX_DIFF_RATIO,
  layoutShiftScore,
  medianInteractionToPaint,
  movingAnimations,
  observeLayoutShift,
  restingScreenshotParity,
  screenshotDiffRatio,
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
    await link.hover();
    const paintMs = await medianInteractionToPaint(page, () => page.mouse.down(), {
      release: () => page.mouse.up(),
    });
    expect(paintMs).toBeLessThanOrEqual(MOTION_BUDGETS.interactionToPaintMs);
  });

  test("reduced motion leaves nothing moving", async ({ page }) => {
    await useReducedMotion(page);
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await movingAnimations(page)).toEqual([]);
  });

  test("the page at rest is the same without JavaScript", async ({ page, baseURL }) => {
    await page.goto("/");
    const { withJs, withoutJs } = await restingScreenshotParity(page, "/", {
      contextOptions: baseURL ? { baseURL } : {},
    });
    expect(await screenshotDiffRatio(page, withJs, withoutJs)).toBeLessThanOrEqual(
      RESTING_PARITY_MAX_DIFF_RATIO,
    );
  });
});
