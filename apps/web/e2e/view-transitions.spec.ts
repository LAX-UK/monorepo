import { expect, test } from "@playwright/test";
import {
  MOTION_BUDGETS,
  layoutShiftScore,
  medianInputToTransitionReady,
  observeLayoutShift,
  observeViewTransitions,
  throttleCpu,
  useReducedMotion,
  viewTransitions,
} from "./helpers/motion-check";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

const themeToggle = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /Switch to (dark|light) theme/ }).first();

// Opt-in (not part of the PR gate): `pnpm --filter @auction/web test:e2e:motion`.
test.describe("view transitions on Bid @optin", () => {
  test.skip(!enabled, skipReason);

  test("the theme toggle plays the circle wipe, and only the toggle does", async ({ page }) => {
    await observeViewTransitions(page);
    await observeLayoutShift(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await themeToggle(page).click();
    const records = await viewTransitions(page);
    expect(records.map((r) => r.kind)).toEqual(["theme"]);
    // What the browser really animates: the new root image is revealed by `theme-reveal`.
    const root = records[0]?.animations.filter((a) => a.pseudo === "::view-transition-new(root)");
    expect(root?.map((a) => a.name)).toContain("theme-reveal");
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.hasAttribute("data-view-transition")),
      )
      .toBe(false);
    expect(await layoutShiftScore(page)).toBeLessThanOrEqual(MOTION_BUDGETS.layoutShift);
  });

  test("a second theme toggle keeps the wipe", async ({ page }) => {
    await observeViewTransitions(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const toggle = themeToggle(page);
    await toggle.click();
    await page.waitForTimeout(50);
    await toggle.click();
    const records = await viewTransitions(page);
    const last = records.at(-1);
    expect(last?.skipped).toBe(false);
    expect(last?.animations.map((a) => a.name)).toContain("theme-reveal");
  });

  test("a lot navigation is an unmarked page change: it morphs the image and never plays the wipe", async ({
    page,
  }) => {
    await observeViewTransitions(page);
    await observeLayoutShift(page);
    await page.goto("/lots");
    await page.waitForLoadState("networkidle");
    const tile = page.locator('[data-lot-transition-root] a[href*="/lots/"]').first();
    await tile.scrollIntoViewIfNeeded();
    await tile.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/lots\//);
    const records = await viewTransitions(page);
    expect(records.map((r) => r.kind)).toEqual(["none"]);
    const names = records[0]?.animations.map((a) => a.name) ?? [];
    expect(names).not.toContain("theme-reveal");
    const morph = records[0]?.animations.filter((a) =>
      a.pseudo.startsWith("::view-transition-group("),
    );
    expect(morph?.length).toBeGreaterThan(0);
    // `--lax-motion-morph`: every group runs at the morph duration.
    expect(morph?.every((a) => a.duration === 360)).toBe(true);
    expect(await layoutShiftScore(page)).toBeLessThanOrEqual(MOTION_BUDGETS.layoutShift);
  });

  test("the page change paints its first transition frame within budget", async ({ page }) => {
    await observeViewTransitions(page);
    await page.goto("/lots");
    await page.waitForLoadState("networkidle");
    await throttleCpu(page);
    // Median of 5 page changes at 4x CPU slowdown. The budget is 200 ms; a page change on a
    // warm list answers in well under a third of that, so a normal run keeps a large margin and
    // one slow frame (the median ignores it) cannot fail the check.
    const medianMs = await medianInputToTransitionReady(page, {
      prepare: async () => {
        await page.goto("/lots");
        await page.waitForLoadState("networkidle");
        const tile = page.locator('[data-lot-transition-root] a[href*="/lots/"]').first();
        await tile.scrollIntoViewIfNeeded();
        await tile.focus();
      },
      perform: () => page.keyboard.press("Enter"),
      runs: 5,
    });
    expect(medianMs).toBeLessThanOrEqual(MOTION_BUDGETS.interactionToPaintMs);
  });

  test("reduced motion swaps content without any transition", async ({ page }) => {
    await useReducedMotion(page);
    await observeViewTransitions(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await themeToggle(page).click();
    expect(await viewTransitions(page)).toEqual([]);
  });

  test("reduced motion also swaps a lot navigation without a transition", async ({ page }) => {
    await useReducedMotion(page);
    await observeViewTransitions(page);
    await page.goto("/lots");
    await page.waitForLoadState("networkidle");
    const tile = page.locator('[data-lot-transition-root] a[href*="/lots/"]').first();
    await tile.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/lots\//);
    expect(await viewTransitions(page)).toEqual([]);
  });

  test("the in-app reduce switch skips every transition, without the OS setting", async ({
    page,
  }) => {
    // What the settings page stores; the pre-paint script mirrors it onto <html data-reduce-motion>.
    await page.addInitScript(() => window.localStorage.setItem("lax.reduceMotion", "force-reduce"));
    await observeViewTransitions(page);
    await page.goto("/lots");
    await page.waitForLoadState("networkidle");
    await themeToggle(page).click();
    const tile = page.locator('[data-lot-transition-root] a[href*="/lots/"]').first();
    await tile.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/lots\//);
    expect(await viewTransitions(page)).toEqual([]);
  });

  test("the in-app allow switch keeps the theme wipe under the OS setting", async ({ page }) => {
    await useReducedMotion(page);
    await page.addInitScript(() => window.localStorage.setItem("lax.reduceMotion", "force-allow"));
    await observeViewTransitions(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await themeToggle(page).click();
    const records = await viewTransitions(page);
    expect(records.map((r) => r.kind)).toEqual(["theme"]);
    expect(records[0]?.animations.map((a) => a.name)).toContain("theme-reveal");
  });
});
