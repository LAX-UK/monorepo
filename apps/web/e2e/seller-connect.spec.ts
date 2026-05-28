import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1 and start apps/web (pnpm dev).";

const clientEmail = process.env.PLAYWRIGHT_CLIENT_EMAIL ?? "";
const clientPassword = process.env.PLAYWRIGHT_CLIENT_PASSWORD ?? "";

async function clientLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(clientEmail);
  await page.getByLabel(/password/i).fill(clientPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

test.describe("seller connect embedded", () => {
  test("seller connect page loads workspace shell", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");

    await clientLogin(page);
    await page.goto("/dashboard/seller/connect");
    await expect(page.getByRole("heading", { name: /payout setup/i })).toBeVisible();
    const workspace = page.getByTestId("connect-workspace");
    const empty = page.getByText(/payout setup is not available/i);
    await expect(workspace.or(empty)).toBeVisible({ timeout: 15_000 });
  });

  test("seller connect page does not show slice error for not_connected state", async ({
    page,
  }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");

    await clientLogin(page);
    await page.goto("/dashboard/seller/connect");
    await expect(page.getByText(/stripe connect not set up/i)).toHaveCount(0);
    const workspace = page.getByTestId("connect-workspace");
    const empty = page.getByText(/payout setup is not available/i);
    await expect(workspace.or(empty)).toBeVisible({ timeout: 15_000 });
  });

  test("seller connect loading skeleton matches embedded layout", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");

    await clientLogin(page);
    await page.goto("/dashboard/seller/connect");
    await expect(
      page.getByTestId("connect-workspace-skeleton").or(page.getByTestId("connect-workspace")),
    ).toBeVisible({
      timeout: 15_000,
    });
  });
});
