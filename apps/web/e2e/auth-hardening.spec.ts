import { expect, test } from "@playwright/test";

test.describe("auth hardening @smoke", () => {
  test("login entry reaches hosted identity chrome", async ({ page }) => {
    const res = await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(res?.ok()).toBeTruthy();
    await page.waitForURL(/\/(login|oauth2\/authorize|api\/auth\/login)/, { timeout: 30_000 });
    const hostedLogin = page.locator("#login-form");
    const hostedHeading = page.getByRole("heading", { name: /sign in/i });
    await expect(hostedLogin.or(hostedHeading).first()).toBeVisible({ timeout: 30_000 });
  });
});
