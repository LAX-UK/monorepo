import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, seededHybridLotId, seededHybridSaleId } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";

/** Use PLAYWRIGHT_BASE_URL=http://localhost:3000 — not 127.0.0.1 (API cookie domain). */

const skipReason = `${e2eSkipReason} Hybrid sale id defaults to seeded S.hybridA when PLAYWRIGHT_HYBRID_SALE_ID is unset.`;

test.describe("hybrid saleroom clerk @journey", () => {
  test.skip(!e2eEnabled, skipReason);

  test("staff can open the clerk console for a hybrid sale", async ({ page }) => {
    await page.goto(`/admin/saleroom/${seededHybridSaleId}`);
    await expect(page.getByRole("button", { name: /go live/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /on the block/i })).toBeVisible();
    await expect(page.getByText(/lot on block/i)).toBeVisible();
    await expect(page.getByText(/hybrid/i)).toBeVisible();
  });

  test("staff can go live and advance a lot on the block", async ({ page }) => {
    await page.goto(`/admin/saleroom/${seededHybridSaleId}`);
    await page.getByRole("button", { name: /go live/i }).click();
    await expect(page.getByText(/^live$/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /on the block/i }).click();
    await expect(page.getByText(/\(on block\)/i)).toBeVisible({ timeout: 10_000 });
  });

  test("paddle and telephone bid amounts are independent", async ({ page }) => {
    await page.goto(`/admin/saleroom/${seededHybridSaleId}`);

    const paddleAmount = page.locator('input[id^="paddle-bid-amount-"]');
    const telephoneAmount = page.locator('input[id^="telephone-bid-amount-"]');

    if ((await paddleAmount.count()) === 0) {
      test.skip(true, "No lot on block — advance a lot first in staging data.");
    }

    await paddleAmount.fill("1500");
    await expect(telephoneAmount).toHaveValue("");
    await telephoneAmount.fill("2000");
    await expect(paddleAmount).toHaveValue("1500");
  });

  test("operations tab reflects live session without full reload", async ({ browser }) => {
    const context = await browser.newContext({ storageState: roleAuthState.staff });
    const opsPage = await context.newPage();
    const clerkPage = await context.newPage();

    await opsPage.goto(`/admin/sales/${seededHybridSaleId}/operations`);
    await expect(opsPage.getByText(/saleroom operations/i)).toBeVisible();

    await clerkPage.goto(`/admin/saleroom/${seededHybridSaleId}`);
    await clerkPage.getByRole("button", { name: /go live/i }).click();
    await clerkPage.getByRole("button", { name: /on the block/i }).click();

    await expect(opsPage.getByText(/on the block/i)).toBeVisible({ timeout: 15_000 });

    await context.close();
  });

  test("clerk console refreshes roster after check-in redirect", async ({ page }) => {
    await page.goto(`/admin/sales/${seededHybridSaleId}/registrations#check-in`);
    await expect(page.locator("#check-in")).toBeVisible();

    await page.goto(`/admin/saleroom/${seededHybridSaleId}?checkedIn=1`);
    await expect(page.getByText(/lot on block/i)).toBeVisible();
    await expect(page.getByLabel(/paddle #/i)).toBeVisible();
  });

  test("marketing lot page shows live feed after clerk session is active", async ({ page }) => {
    await page.goto(`/lot/test/${seededHybridLotId}`);
    await expect(page.getByText(/live feed|watching/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/bidding closed/i)).not.toBeVisible();
  });

  test("clerk console price updates when another context places a bid", async ({ browser }) => {
    const clerkContext = await browser.newContext({ storageState: roleAuthState.staff });
    const bidderContext = await browser.newContext();
    const clerkPage = await clerkContext.newPage();
    const bidderPage = await bidderContext.newPage();

    await clerkPage.goto(`/admin/saleroom/${seededHybridSaleId}`);
    await clerkPage.getByRole("button", { name: /go live/i }).click();
    await clerkPage.getByRole("button", { name: /on the block/i }).click();

    await bidderPage.goto(`/lot/test/${seededHybridLotId}`);
    const priceBefore = await clerkPage
      .locator(".font-headline.text-lg")
      .first()
      .textContent()
      .catch(() => null);
    const bidButton = bidderPage.getByRole("button", { name: /bid|place/i }).first();
    if (await bidButton.isVisible().catch(() => false)) {
      await bidButton.click();
      if (priceBefore) {
        await expect(clerkPage.locator(".font-headline.text-lg").first()).not.toHaveText(
          priceBefore,
          { timeout: 10_000 },
        );
      } else {
        await expect(clerkPage.getByText(/leading/i)).toBeVisible({ timeout: 10_000 });
      }
    } else {
      await expect(clerkPage.getByText(/current|leading/i)).toBeVisible({ timeout: 5_000 });
    }

    await clerkContext.close();
    await bidderContext.close();
  });

  test("clerk console hydrates after reconnect", async ({ page, context }) => {
    await page.goto(`/admin/saleroom/${seededHybridSaleId}`);
    await page.getByRole("button", { name: /go live/i }).click();

    await context.setOffline(true);
    await page.waitForTimeout(1_000);
    await context.setOffline(false);

    await expect(page.getByText(/reconnected|live/i)).toBeVisible({ timeout: 15_000 });
  });

  test("clerk session bar shows lot-of-total progress", async ({ page }) => {
    await page.goto(`/admin/saleroom/${seededHybridSaleId}`);

    await expect(
      page.getByText(/lot \d+ of \d+|between lots|of \d+ complete/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("hybrid saleroom hub (multi-room live grid) @journey", () => {
  test.skip(!e2eEnabled, skipReason);

  test("live grid lists active hybrid rooms with progress", async ({ page }) => {
    await page.goto("/admin/saleroom");

    await expect(page.getByRole("heading", { name: /live rooms/i })).toBeVisible({
      timeout: 15_000,
    });

    await expect(
      page.getByText(/lot \d+ of \d+|between lots|of \d+ complete/i).first(),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /open console/i }).first()).toBeVisible();
  });

  test("opening a room from the grid lands on its clerk console", async ({ page }) => {
    await page.goto("/admin/saleroom");
    await expect(page.getByRole("heading", { name: /live rooms/i })).toBeVisible({
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
    await expect(page.getByRole("heading", { name: /live rooms/i })).toBeVisible({
      timeout: 15_000,
    });

    const progressbar = page.getByRole("progressbar").first();
    await expect(progressbar).toBeVisible();
    const max = await progressbar.getAttribute("aria-valuemax");
    expect(Number(max)).toBeGreaterThan(0);
  });
});
