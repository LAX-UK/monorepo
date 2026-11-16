import type { Locator, Page } from "@playwright/test";
import {
  MOTION_BUDGETS,
  layoutShiftScore,
  medianInteractionToPaint,
  movingAnimations,
  observeLayoutShift,
  throttleCpu,
  useReducedMotion,
} from "../../web/e2e/helpers/motion-check";
import { requireStaffAcceptanceCredentials } from "./support/staff-credentials.js";
import { openStaffBrowserSession } from "./support/staff-session.js";
import { expect, test } from "./support/test.js";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const authBaseUrl = process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid";

/**
 * LAX Admin's record panel (`DetailPanel`, the kit `Sheet`) opening from a list row
 * (docs/design/motion.md, step 7, MO14). On staff pages it is a fade on the panel tokens with no
 * slide; under reduced motion it is instant. The motion check is shared with Bid admin.
 */
test.describe("record panel motion on LAX Admin @optin", () => {
  test.setTimeout(120_000);
  test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 against deployed shop-admin");

  async function openAuditLog(page: Page): Promise<Locator> {
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
    await page.goto(`${session.baseUrl}/audit`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
    const opener = page.locator("tbody tr").first().getByRole("link").first();
    await expect(opener, "the audit log has a record to open").toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    return opener;
  }

  const panel = (page: Page) => page.locator('[role="dialog"][data-lax-motion="sheet"]');

  async function closePanel(page: Page): Promise<void> {
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
  }

  test("a record panel opens with a fade, quickly and without layout shift", async ({ page }) => {
    await observeLayoutShift(page);
    const opener = await openAuditLog(page);

    await opener.click();
    await expect(panel(page)).toBeVisible();
    // A staff panel fades on the panel token and never slides in.
    expect(
      await panel(page).evaluate((el) => {
        const style = getComputedStyle(el);
        return `${style.animationName} ${style.animationDuration}`;
      }),
    ).toBe("lax-fade-in 0.2s");
    await closePanel(page);

    await throttleCpu(page);
    await opener.hover();
    const interaction = await medianInteractionToPaint(page, () => page.mouse.down(), {
      release: async () => {
        await page.mouse.up();
        await expect(panel(page)).toBeVisible();
        await closePanel(page);
        await opener.hover();
      },
    });
    expect(interaction, "the row answers a press within budget").toBeLessThanOrEqual(
      MOTION_BUDGETS.interactionToPaintMs,
    );
    expect(await layoutShiftScore(page)).toBeLessThanOrEqual(MOTION_BUDGETS.layoutShift);
  });

  test("a record panel moves nothing under reduced motion", async ({ page }) => {
    const opener = await openAuditLog(page);
    await useReducedMotion(page);
    await opener.click();
    await expect(panel(page)).toBeVisible();
    // Staff tools are instant under reduced motion: not even a fade is running.
    expect(await movingAnimations(page, { includeFades: true })).toEqual([]);
    await closePanel(page);
  });
});
