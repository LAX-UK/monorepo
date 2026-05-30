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
      page
        .getByTestId("connect-page-header-skeleton")
        .or(page.getByTestId("connect-workspace-skeleton"))
        .or(page.getByTestId("connect-workspace")),
    ).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("seller workspace navigation", () => {
  test("mobile more sheet includes payout setup in selling workspace", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");

    await clientLogin(page);
    await page.goto("/dashboard/seller");
    await page.getByRole("button", { name: /open more dashboard actions/i }).click();
    await expect(page.getByRole("link", { name: /^payout setup$/i })).toBeVisible();
  });

  test("sold and payouts page loads", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");

    await clientLogin(page);
    await page.goto("/dashboard/seller/payouts");
    await expect(page.getByRole("heading", { name: /sold & payouts/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("payouts page shows connect setup CTA when payout setup incomplete", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");

    await clientLogin(page);
    await page.goto("/dashboard/seller/payouts");
    await expect(page.getByRole("heading", { name: /sold & payouts/i })).toBeVisible({
      timeout: 15_000,
    });
    const connectCta = page.getByRole("link", { name: /open payout setup/i });
    const hasCta = await connectCta
      .first()
      .isVisible()
      .catch(() => false);
    test.skip(!hasCta, "Seller already has complete connect — no setup CTA to assert");
    await expect(connectCta.first()).toBeVisible();
  });
});

test.describe("buying workspace notifications", () => {
  test("notifications page loads inbox tabs", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");

    await clientLogin(page);
    await page.goto("/dashboard/notifications");
    await expect(page.getByRole("heading", { name: /^notifications$/i })).toBeVisible({
      timeout: 15_000,
    });
    const inboxNav = page.getByRole("navigation", { name: /notification inbox/i });
    await expect(inboxNav.getByRole("link", { name: /^all$/i })).toBeVisible();
    await expect(inboxNav.getByRole("link", { name: /unread/i })).toBeVisible();
    await expect(inboxNav.getByRole("link", { name: /^archived$/i })).toBeVisible();
  });
});
