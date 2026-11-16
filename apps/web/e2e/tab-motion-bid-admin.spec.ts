import { type Page, expect, test } from "@playwright/test";
import {
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  e2eSkipReason,
  gotoAdminPath,
  seededStaffRoutes,
} from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  MOTION_BUDGETS,
  layoutShiftScore,
  medianInteractionToPaint,
  movingAnimations,
  observeLayoutShift,
  throttleCpu,
  useReducedMotion,
} from "./helpers/motion-check";

const COVER_PATH = `/admin/sales/${seededStaffRoutes.saleDetail}/cover`;

/**
 * The cover slot panel's resolved animation, as `name duration`. Read from computed style, not the
 * running animation, so the check does not race the 150ms fade.
 */
async function panelAnimation(page: Page): Promise<string> {
  return page.locator('[role="tabpanel"][data-lax-motion="tabpanel"]').evaluate((el) => {
    const style = getComputedStyle(el);
    return `${style.animationName} ${style.animationDuration}`;
  });
}

async function openCover(page: Page): Promise<void> {
  await gotoAdminPath(page, COVER_PATH);
  await dismissStaffPaletteIfOpen(page);
  await expect(page.getByRole("tablist", { name: "Cover pictures" })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle");
}

const tab = (page: Page, name: RegExp) =>
  page.getByRole("tablist", { name: "Cover pictures" }).getByRole("tab", { name });

// Opt-in with the other motion checks: `pnpm --filter @auction/web test:e2e:motion`.
// The live in-place staff tab panel in Bid admin: the sale cover slot picker (docs/design/motion.md,
// step 7). Route tabs (`TabNav`) change content by navigation and take the staff page cross-fade,
// which view-transition-css.spec.ts covers.
test.describe("tab motion on Bid admin @optin", () => {
  test.skip(!e2eEnabled, e2eSkipReason);
  test.use({ storageState: roleAuthState.staff });

  test("a slot switch fades the panel on the staff token, quickly and without layout shift", async ({
    page,
  }) => {
    await observeLayoutShift(page);
    await openCover(page);

    await tab(page, /^Wide/).click();
    await expect(tab(page, /^Wide/)).toHaveAttribute("aria-selected", "true");
    // The kit fade (opacity only) on the staff enter token; the selected border has no transition.
    expect(await panelAnimation(page)).toBe("lax-fade-in 0.15s");
    expect(await tab(page, /^Wide/).evaluate((el) => getComputedStyle(el).transitionProperty)).toBe(
      "none",
    );

    await throttleCpu(page);
    await tab(page, /^Default/).focus();
    const interaction = await medianInteractionToPaint(
      page,
      () => page.keyboard.press("ArrowRight"),
      {
        inputType: "keydown",
      },
    );
    expect(interaction, "a slot switch paints within budget").toBeLessThanOrEqual(
      MOTION_BUDGETS.interactionToPaintMs,
    );
    expect(await layoutShiftScore(page)).toBeLessThanOrEqual(MOTION_BUDGETS.layoutShift);
  });

  test("a slot switch moves nothing under reduced motion", async ({ page }) => {
    await openCover(page);
    await useReducedMotion(page);
    for (const name of [/^Wide/, /^Phone/, /^Default/]) {
      await tab(page, name).click();
      await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
      // Staff tools are instant under reduced motion: not even a fade is running.
      expect(await movingAnimations(page, { includeFades: true })).toEqual([]);
    }
  });
});
