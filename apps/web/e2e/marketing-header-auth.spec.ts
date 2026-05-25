/**
 * E2E test: Marketing header shows authenticated state after client-side navigation.
 *
 * Verifies that after login, navigating from dashboard to marketing pages
 * shows the authenticated header (account menu) without requiring a hard refresh.
 */
import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

const buyerEmail = process.env.PLAYWRIGHT_BUYER_EMAIL ?? "buyer@lax.bid";
const buyerPassword = process.env.PLAYWRIGHT_BUYER_PASSWORD ?? "password";
const apiBase = (process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(buyerEmail);
  await page.getByLabel(/password/i).fill(buyerPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 20_000 });
}

test.describe("marketing header auth", () => {
  test("header shows authenticated state after client navigation from dashboard to search", async ({
    page,
  }) => {
    test.skip(!enabled, skipReason);

    await login(page);

    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({
      timeout: 10_000,
    });

    await page
      .getByRole("link", { name: /^search$/i })
      .first()
      .click();
    await page.waitForURL(/\/search/, { timeout: 10_000 });

    const accountMenuButton = page.getByRole("button", { name: /account menu/i });
    const loginLink = page.getByRole("link", { name: /log in/i });

    await expect(accountMenuButton).toBeVisible({ timeout: 5_000 });
    await expect(loginLink).not.toBeVisible();
  });

  test("header updates across tabs on logout", async ({ context }) => {
    test.skip(!enabled, skipReason);

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await login(page1);

    await page2.goto("/");
    await page2.waitForLoadState("domcontentloaded");
    await expect(page2.getByRole("button", { name: /account menu/i })).toBeVisible({
      timeout: 10_000,
    });

    await page1.getByRole("button", { name: /account menu/i }).click();
    await page1.getByRole("menuitem", { name: /sign out/i }).click();
    await page1.waitForURL("/", { timeout: 10_000 });

    await expect(page2.getByRole("link", { name: /log in/i })).toBeVisible({ timeout: 10_000 });
  });

  test("header updates across tabs when sign-out is triggered via Better Auth API", async ({
    context,
  }) => {
    test.skip(!enabled, skipReason);

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await login(page1);

    await page2.goto("/");
    await expect(page2.getByRole("button", { name: /account menu/i })).toBeVisible({
      timeout: 10_000,
    });

    await page1.evaluate(async (base) => {
      await fetch(`${base}/api/auth/sign-out`, { method: "POST", credentials: "include" });
    }, apiBase);

    await expect(page2.getByRole("link", { name: /log in/i })).toBeVisible({ timeout: 10_000 });
  });
});
