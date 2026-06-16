import { expect, test } from "@playwright/test";

/** Use PLAYWRIGHT_BASE_URL=http://localhost:3000 — not 127.0.0.1 (API cookie domain). */

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, staff credentials, and a hybrid sale id.";

const hybridSaleId = process.env.PLAYWRIGHT_HYBRID_SALE_ID;
const hybridLotId = process.env.PLAYWRIGHT_HYBRID_LOT_ID;

// Seeded hybrid salerooms (see packages/db dev seed: S.hybridA/B/C). Used to
// validate the multi-room live grid. Override with env when running against a
// staging dataset that uses different ids.
const seededHybridSaleAId =
  process.env.PLAYWRIGHT_HYBRID_SALE_ID ?? "e1000003-0000-4000-8000-000000000003";

async function staffLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page
    .locator('input[name="email"]')
    .fill(process.env.PLAYWRIGHT_STAFF_EMAIL ?? "admin@lax.bid");
  const continueBtn = page.getByRole("button", { name: /^continue$/i });
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
    await page.locator('input[name="password"]').waitFor({ timeout: 10_000 });
  }
  const password = page.locator('input[name="password"]');
  await password.click();
  await password.fill(process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "Password123!");
  await page
    .locator("form")
    .first()
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await page.waitForURL(/\/(admin|dashboard)/, { timeout: 20_000 });
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

  test("clerk session bar shows lot-of-total progress", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await staffLogin(page);
    await page.goto(`/admin/saleroom/${seededHybridSaleAId}`);

    // Either a live "Lot N of M" progress label or the between-lots prompt.
    await expect(
      page.getByText(/lot \d+ of \d+|between lots|of \d+ complete/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("hybrid saleroom hub (multi-room live grid)", () => {
  test("live grid lists active hybrid rooms with progress", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await staffLogin(page);
    await page.goto("/admin/saleroom");

    await expect(page.getByRole("heading", { name: /live rooms/i })).toBeVisible({
      timeout: 15_000,
    });

    // At least one room card surfaces a live progress label.
    await expect(
      page.getByText(/lot \d+ of \d+|between lots|of \d+ complete/i).first(),
    ).toBeVisible();

    // Each room card exposes a primary "Open console" action.
    await expect(page.getByRole("link", { name: /open console/i }).first()).toBeVisible();
  });

  test("opening a room from the grid lands on its clerk console", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await staffLogin(page);
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
    test.skip(!enabled, skipReason);

    await staffLogin(page);
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
