import { expect, test } from "@playwright/test";

test.describe("auth hardening @smoke", () => {
  test("login page loads", async ({ page }) => {
    const res = await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });
});
