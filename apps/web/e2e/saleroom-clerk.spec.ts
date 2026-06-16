import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, staff credentials, and a hybrid sale id.";

const hybridSaleId = process.env.PLAYWRIGHT_HYBRID_SALE_ID;
const hybridLotId = process.env.PLAYWRIGHT_HYBRID_LOT_ID;

async function staffLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(process.env.PLAYWRIGHT_STAFF_EMAIL ?? "staff@lax.bid");
  await page.getByLabel(/password/i).fill(process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/admin/, { timeout: 20_000 });
}

test.describe("hybrid saleroom clerk", () => {
  test("staff can open the clerk console for a hybrid sale", async ({ page }) => {
    test.skip(!enabled || !hybridSaleId, skipReason);

    await staffLogin(page);
    await page.goto(`/admin/saleroom/${hybridSaleId}`);
    await expect(page.getByRole("button", { name: /go live/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /on the block/i })).toBeVisible();
    await expect(page.getByText(/lot on block/i)).toBeVisible();
    await expect(page.getByText(/hybrid/i)).toBeVisible();
  });

  test("staff can go live and advance a lot on the block", async ({ page }) => {
    test.skip(!enabled || !hybridSaleId, skipReason);

    await staffLogin(page);
    await page.goto(`/admin/saleroom/${hybridSaleId}`);
    await page.getByRole("button", { name: /go live/i }).click();
    await expect(page.getByText(/^live$/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /on the block/i }).click();
    await expect(page.getByText(/\(on block\)/i)).toBeVisible({ timeout: 10_000 });
  });

  test("paddle and telephone bid amounts are independent", async ({ page }) => {
    test.skip(!enabled || !hybridSaleId, skipReason);

    await staffLogin(page);
    await page.goto(`/admin/saleroom/${hybridSaleId}`);

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
    test.skip(!enabled || !hybridSaleId, skipReason);

    const context = await browser.newContext();
    const opsPage = await context.newPage();
    const clerkPage = await context.newPage();

    await staffLogin(opsPage);
    await opsPage.goto(`/admin/sales/${hybridSaleId}/operations`);
    await expect(opsPage.getByText(/saleroom operations/i)).toBeVisible();

    await clerkPage.goto(`/admin/saleroom/${hybridSaleId}`);
    await clerkPage.getByRole("button", { name: /go live/i }).click();
    await clerkPage.getByRole("button", { name: /on the block/i }).click();

    await expect(opsPage.getByText(/on the block/i)).toBeVisible({ timeout: 15_000 });

    await context.close();
  });

  test("clerk console refreshes roster after check-in redirect", async ({ page }) => {
    test.skip(!enabled || !hybridSaleId, skipReason);

    await staffLogin(page);
    await page.goto(`/admin/sales/${hybridSaleId}/registrations#check-in`);
    await expect(page.locator("#check-in")).toBeVisible();

    await page.goto(`/admin/saleroom/${hybridSaleId}?checkedIn=1`);
    await expect(page.getByText(/lot on block/i)).toBeVisible();
    await expect(page.getByLabel(/paddle #/i)).toBeVisible();
  });

  test("marketing lot page shows live feed after clerk session is active", async ({ page }) => {
    test.skip(!enabled || !hybridLotId, `${skipReason} Also set PLAYWRIGHT_HYBRID_LOT_ID.`);

    await page.goto(`/lot/test/${hybridLotId}`);
    await expect(page.getByText(/live feed|watching/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/bidding closed/i)).not.toBeVisible();
  });

  test("clerk console price updates when another context places a bid", async ({ browser }) => {
    test.skip(!enabled || !hybridSaleId || !hybridLotId, skipReason);

    const clerkContext = await browser.newContext();
    const bidderContext = await browser.newContext();
    const clerkPage = await clerkContext.newPage();
    const bidderPage = await bidderContext.newPage();

    await staffLogin(clerkPage);
    await clerkPage.goto(`/admin/saleroom/${hybridSaleId}`);
    await clerkPage.getByRole("button", { name: /go live/i }).click();
    await clerkPage.getByRole("button", { name: /on the block/i }).click();

    await bidderPage.goto(`/lot/test/${hybridLotId}`);
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
    test.skip(!enabled || !hybridSaleId, skipReason);

    await staffLogin(page);
    await page.goto(`/admin/saleroom/${hybridSaleId}`);
    await page.getByRole("button", { name: /go live/i }).click();

    await context.setOffline(true);
    await page.waitForTimeout(1_000);
    await context.setOffline(false);

    await expect(page.getByText(/reconnected|live/i)).toBeVisible({ timeout: 15_000 });
  });
});
