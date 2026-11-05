import { type Page, expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, seededHybridLotId, seededHybridSaleId } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";

/** Use PLAYWRIGHT_BASE_URL=http://localhost:3000 — not 127.0.0.1 (API cookie domain). */

const skipReason = `${e2eSkipReason} Hybrid sale id defaults to seeded S.hybridA when PLAYWRIGHT_HYBRID_SALE_ID is unset.`;

const clerkConsole = (page: Page) => page.goto(`/admin/saleroom/${seededHybridSaleId}`);
const lotOnBlockHeading = (page: Page) =>
  page.getByRole("heading", { name: /^lot on block$/i, level: 2 }).first();

/**
 * The seed has Room A live with its third lot (Meridian Drift) on the block, so these tests start
 * from a running session. The test that moves the block on runs last: it changes what is on it.
 */
test.describe("hybrid saleroom clerk @journey", () => {
  test.skip(!e2eEnabled, skipReason);

  test("staff can open the clerk console for a hybrid sale", async ({ page }) => {
    await clerkConsole(page);
    await expect(
      page.getByRole("heading", { name: /hybrid day sale — room a/i, level: 1 }),
    ).toBeVisible();
    const controls = page.getByRole("region", { name: /session controls/i });
    await expect(controls.getByRole("button", { name: /^pause$/i })).toBeVisible();
    await expect(controls.getByRole("button", { name: /^close session$/i })).toBeVisible();
    await expect(lotOnBlockHeading(page)).toBeVisible();
    await expect(page.getByText("Hybrid", { exact: true }).first()).toBeVisible();
  });

  test("staff can pause and resume a live session", async ({ page }) => {
    await clerkConsole(page);
    const controls = page.getByRole("region", { name: /session controls/i });
    await controls.getByRole("button", { name: /^pause$/i }).click();
    // The console follows the session through the realtime sidecar, which the stabilization stack
    // does not run, so the saved state is read from a fresh load.
    await expect(async () => {
      await clerkConsole(page);
      await expect(controls.getByRole("button", { name: /^resume$/i })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 15_000 });

    await controls.getByRole("button", { name: /^resume$/i }).click();
    await expect(async () => {
      await clerkConsole(page);
      await expect(controls.getByRole("button", { name: /^pause$/i })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 15_000 });
  });

  test("a quick amount fills the paddle bid, and placing it needs a paddle number", async ({
    page,
  }) => {
    await clerkConsole(page);

    const paddleAmount = page.locator('input[id^="paddle-bid-amount-"]');
    await expect(paddleAmount).toBeVisible();
    await page.getByRole("button", { name: /^minimum bid/i }).click();
    await expect(paddleAmount).toHaveValue(/^7,?100(\.00)?$/);

    const place = page.getByRole("button", { name: /^place paddle bid$/i });
    await expect(place).toBeDisabled();
    await page.getByRole("textbox", { name: "Paddle number" }).fill("142");
    await expect(paddleAmount).toHaveValue(/^7,?100(\.00)?$/);

    // No telephone line is confirmed for this lot, so there is no telephone amount to fill.
    await expect(page.getByText(/no confirmed telephone lines for this lot/i)).toBeVisible();
    await expect(page.locator('input[id^="telephone-bid-amount-"]')).toHaveCount(0);
  });

  test("clerk console refreshes roster after check-in redirect", async ({ page }) => {
    await page.goto(`/admin/sales/${seededHybridSaleId}/registrations#check-in`);
    await expect(page.locator("#check-in")).toBeVisible();

    await page.goto(`/admin/saleroom/${seededHybridSaleId}?checkedIn=1`);
    await expect(lotOnBlockHeading(page)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Paddle number" })).toBeVisible();
  });

  test("marketing lot page stays open for bidding while the lot is on the block", async ({
    page,
  }) => {
    await page.goto(`/lot/test/${seededHybridLotId}`);
    await expect(page.getByRole("button", { name: /^bid history/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/bidding closed/i)).not.toBeVisible();
  });

  test("clerk session bar shows lot-of-total progress", async ({ page }) => {
    await clerkConsole(page);

    await expect(
      page.getByText(/lot \d+ of \d+|between lots|of \d+ complete/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("operations tab shows the lot the clerk moved to", async ({ browser }) => {
    const context = await browser.newContext({ storageState: roleAuthState.staff });
    const opsPage = await context.newPage();
    const clerkPage = await context.newPage();

    await opsPage.goto(`/admin/sales/${seededHybridSaleId}/operations`);
    await expect(opsPage.getByRole("heading", { name: /saleroom operations/i })).toBeVisible();
    await expect(opsPage.getByText(/meridian drift/i).first()).toBeVisible();

    await clerkConsole(clerkPage);
    await clerkPage.getByRole("button", { name: /^advance next/i }).click();

    // Live updates come through the realtime sidecar, which this stack does not run: reload.
    await expect(async () => {
      await opsPage.reload();
      await expect(opsPage.getByText(/glass horizon/i).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    await context.close();
  });
});

test.describe("hybrid saleroom hub (multi-room live grid) @journey", () => {
  test.skip(!e2eEnabled, skipReason);

  test("live grid lists active hybrid rooms with progress", async ({ page }) => {
    await page.goto("/admin/saleroom");

    await expect(page.getByRole("heading", { name: /rooms to run/i })).toBeVisible({
      timeout: 15_000,
    });

    await expect(
      page.getByText(/lot \d+ of \d+|between lots|of \d+ complete/i).first(),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /open console/i }).first()).toBeVisible();
  });

  test("opening a room from the grid lands on its clerk console", async ({ page }) => {
    await page.goto("/admin/saleroom");
    await expect(page.getByRole("heading", { name: /rooms to run/i })).toBeVisible({
      timeout: 15_000,
    });

    await page
      .getByRole("link", { name: /open console/i })
      .first()
      .click();
    await page.waitForURL(/\/admin\/saleroom\/[0-9a-f-]+/i, { timeout: 15_000 });
    await expect(page.getByText(/hybrid|live|paused/i).first()).toBeVisible();
  });

  test("live grid renders a progress bar reflecting completed lots", async ({ page }) => {
    await page.goto("/admin/saleroom");
    await expect(page.getByRole("heading", { name: /rooms to run/i })).toBeVisible({
      timeout: 15_000,
    });

    const progressbar = page.getByRole("progressbar").first();
    await expect(progressbar).toBeVisible();
    const max = await progressbar.getAttribute("aria-valuemax");
    expect(Number(max)).toBeGreaterThan(0);
  });
});
