import { type Locator, type Page, expect } from "@playwright/test";
import {
  MOTION_BUDGETS,
  layoutShiftScore,
  medianInteractionToPaint,
  movingAnimations,
  throttleCpu,
  useReducedMotion,
} from "./motion-check";

/**
 * The overlay motion proof every staff surface shares (docs/design/motion.md, MO14): one menu and
 * one dialog open without layout shift, answer the press within the interaction budget at 4x CPU
 * slowdown, and move nothing under reduced motion (the staff tools go fully instant).
 *
 * Used by Bid admin (apps/web) and LAX Admin (apps/shop-admin). The page must already be on a
 * staff screen, and `observeLayoutShift(page)` must have run before it was loaded.
 */
export type OverlayTargets = {
  /** The button that opens a menu. */
  menuTrigger: Locator;
  /** The button that opens a dialog. */
  dialogTrigger: Locator;
};

async function pressesWithinBudget(page: Page, trigger: Locator): Promise<number> {
  await trigger.hover();
  return medianInteractionToPaint(page, () => page.mouse.down(), {
    // Releasing the press is what opens the overlay; Escape closes it for the next run.
    release: async () => {
      await page.mouse.up();
      await page.keyboard.press("Escape");
    },
  });
}

export async function expectStaffOverlaysCalm(page: Page, targets: OverlayTargets): Promise<void> {
  await throttleCpu(page);
  for (const [name, trigger] of Object.entries(targets)) {
    expect(
      await pressesWithinBudget(page, trigger),
      `${name} answers a press within budget`,
    ).toBeLessThanOrEqual(MOTION_BUDGETS.interactionToPaintMs);
  }
  expect(await layoutShiftScore(page)).toBeLessThanOrEqual(MOTION_BUDGETS.layoutShift);
}

export async function expectStaffOverlaysStillUnderReducedMotion(
  page: Page,
  targets: OverlayTargets,
): Promise<void> {
  await useReducedMotion(page);
  for (const trigger of Object.values(targets)) {
    await trigger.click();
    await expect(page.locator("[data-lax-motion][data-state='open']").first()).toBeVisible();
    // Staff tools are instant under reduced motion: not even a fade is running.
    expect(await movingAnimations(page, { includeFades: true })).toEqual([]);
    await page.keyboard.press("Escape");
  }
}
