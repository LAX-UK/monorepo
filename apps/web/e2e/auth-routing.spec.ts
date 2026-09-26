import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

test.describe("marketing auth routing @smoke", () => {
  test("login entry reaches hosted identity chrome", async ({ page }) => {
    test.skip(!enabled, skipReason);
    const res = await page.goto("/login");
    expect(res?.ok()).toBeTruthy();
    await page.waitForURL(/\/(login|oauth2\/authorize|api\/auth\/login)/, { timeout: 30_000 });
    const hostedLogin = page.locator("#login-form");
    const hostedHeading = page.getByRole("heading", { name: /sign in/i });
    await expect(hostedLogin.or(hostedHeading).first()).toBeVisible({ timeout: 30_000 });
  });

  test("unsafe next param is not preserved after edge redirect to dashboard", async ({ page }) => {
    test.skip(!enabled, skipReason);
    const base = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000");
    await page.context().addCookies([
      {
        name: "lax-bid-session",
        value: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        domain: base.hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/login?next=%2F%2Fevil.com");
    await page.waitForURL(/\/auth\/post-login|\/login/, { timeout: 15_000 });
    expect(page.url()).not.toContain("evil.com");
    expect(page.url()).toMatch(/auth\/post-login|login/);
  });

  test("session_expired login entry still starts hosted auth", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await page.goto("/login?session_expired=1");
    await page.waitForURL(/\/(login|oauth2\/authorize|api\/auth\/login)/, { timeout: 30_000 });
  });

  test("header sign in starts hosted auth without task-route skeleton", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await page.goto("/");
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: "Sign in" }).click();
    await expect(page.getByTestId("auth-logo-skeleton")).toHaveCount(0);
    const hostedLogin = page.locator("#login-form");
    const hostedHeading = page.getByRole("heading", { name: /sign in/i });
    await expect(hostedLogin.or(hostedHeading).first()).toBeVisible({ timeout: 30_000 });
  });
});
