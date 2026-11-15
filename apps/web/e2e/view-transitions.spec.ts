import { expect, test } from "@playwright/test";
import {
  MOTION_BUDGETS,
  layoutShiftScore,
  medianInteractionToPaint,
  observeLayoutShift,
  throttleCpu,
  useReducedMotion,
} from "./helpers/motion-check";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

/** Records the `data-view-transition` kind of every transition `startViewTransition` starts. */
async function recordTransitions(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __vt: string[] };
    w.__vt = [];
    const original = document.startViewTransition?.bind(document);
    if (!original) return;
    document.startViewTransition = ((update?: () => void) => {
      w.__vt.push(document.documentElement.getAttribute("data-view-transition") ?? "none");
      return original(update);
    }) as typeof document.startViewTransition;
  });
}

const started = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __vt: string[] }).__vt);

// Opt-in (not part of the PR gate): `pnpm --filter @auction/web test:e2e:motion`.
test.describe("view transitions on Bid @optin", () => {
  test.skip(!enabled, skipReason);

  test("the theme toggle plays the circle wipe and nothing else does", async ({ page }) => {
    await recordTransitions(page);
    await observeLayoutShift(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const toggle = page.getByRole("button", { name: /Switch to (dark|light) theme/ }).first();
    await toggle.click();
    expect(await started(page)).toEqual(["theme"]);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.hasAttribute("data-view-transition")),
      )
      .toBe(false);
    expect(await layoutShiftScore(page)).toBeLessThanOrEqual(MOTION_BUDGETS.layoutShift);
  });

  test("a lot navigation morphs the image and never plays the wipe", async ({ page }) => {
    await recordTransitions(page);
    await observeLayoutShift(page);
    await page.goto("/lots");
    await page.waitForLoadState("networkidle");
    await throttleCpu(page);
    const tile = page.locator('[data-lot-transition-root] a[href*="/lots/"]').first();
    await tile.scrollIntoViewIfNeeded();
    const paintMs = await medianInteractionToPaint(
      page,
      async () => {
        await page.mouse.move(0, 0);
        await tile.hover();
        await page.mouse.down();
      },
      { runs: 1, release: () => page.mouse.up() },
    );
    expect(paintMs).toBeLessThanOrEqual(MOTION_BUDGETS.interactionToPaintMs);
    await page.waitForURL(/\/lots\//);
    expect(await started(page)).toEqual(["lot"]);
    expect(await layoutShiftScore(page)).toBeLessThanOrEqual(MOTION_BUDGETS.layoutShift);
  });

  test("reduced motion swaps content without any transition", async ({ page }) => {
    await useReducedMotion(page);
    await recordTransitions(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("button", { name: /Switch to (dark|light) theme/ })
      .first()
      .click();
    expect(await started(page)).toEqual([]);
  });
});
