import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, staff credentials, and a hybrid sale id.";

const hybridSaleId = process.env.PLAYWRIGHT_HYBRID_SALE_ID;

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
});
