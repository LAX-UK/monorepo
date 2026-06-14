import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, staff credentials, and a hybrid sale id.";

const hybridSaleId = process.env.PLAYWRIGHT_HYBRID_SALE_ID;
const hybridLotId = process.env.PLAYWRIGHT_HYBRID_LOT_ID;

test.describe("hybrid saleroom clerk", () => {
  test("staff can open the clerk console for a hybrid sale", async ({ page }) => {
    test.skip(!enabled || !hybridSaleId, skipReason);

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.PLAYWRIGHT_STAFF_EMAIL ?? "staff@lax.bid");
    await page.getByLabel(/password/i).fill(process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/admin/, { timeout: 20_000 });

    await page.goto(`/admin/saleroom/${hybridSaleId}`);
    await expect(page.getByRole("button", { name: /go live/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /on the block/i })).toBeVisible();
    await expect(page.getByText(/lot on block/i)).toBeVisible();
  });

  test("staff can go live and advance a lot on the block", async ({ page }) => {
    test.skip(!enabled || !hybridSaleId, skipReason);

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.PLAYWRIGHT_STAFF_EMAIL ?? "staff@lax.bid");
    await page.getByLabel(/password/i).fill(process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/admin/, { timeout: 20_000 });

    await page.goto(`/admin/saleroom/${hybridSaleId}`);
    await page.getByRole("button", { name: /go live/i }).click();
    await expect(page.getByText(/status:\s*live/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /on the block/i }).click();
    await expect(page.getByText(/\(on block\)/i)).toBeVisible({ timeout: 10_000 });
  });

  test("marketing lot page shows live feed after clerk session is active", async ({ page }) => {
    test.skip(!enabled || !hybridLotId, `${skipReason} Also set PLAYWRIGHT_HYBRID_LOT_ID.`);

    await page.goto(`/lot/test/${hybridLotId}`);
    await expect(page.getByText(/live feed|watching/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/bidding closed/i)).not.toBeVisible();
  });

  test("staging: two-browser competitor bid requires manual verification", async () => {
    test.skip(!enabled, skipReason);
    test.fixme(
      true,
      "Manual staging checklist: Browser A bids on live lot; Browser B feed+price update within 2s.",
    );
  });

  test("staging: reconnect hydration requires manual verification", async () => {
    test.skip(!enabled, skipReason);
    test.fixme(
      true,
      "Manual staging checklist: disconnect Browser B, bid on A, reconnect B — history matches API.",
    );
  });
});
