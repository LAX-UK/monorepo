import { type Page, expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

async function loginAsBuyer(page: Page) {
  const consent = encodeURIComponent(
    JSON.stringify({
      v: 1,
      ts: new Date().toISOString(),
      necessary: true,
      analytics: false,
      marketing: false,
    }),
  );
  await page.context().addCookies([
    {
      name: "lax_consent",
      value: consent,
      url: baseUrl,
    },
  ]);
  const email = process.env.PLAYWRIGHT_BUYER_EMAIL ?? "buyer@lax.bid";
  const password = process.env.PLAYWRIGHT_BUYER_PASSWORD ?? "password";
  await page.goto(`/login?email=${encodeURIComponent(email)}`);
  const continueButton = page.getByRole("button", { name: /^continue$/i });
  if (await continueButton.isVisible().catch(() => false)) await continueButton.click();
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(?:dashboard|onboarding)(?:\/|\?|$)/, { timeout: 20_000 });
}

test.describe("auction interests settings @journey", () => {
  test("requires authentication", async ({ page }) => {
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the standard web/API stack.");

    await page.goto("/dashboard/settings/interests");

    await expect(page).toHaveURL(/\/login/);
  });

  test("eligible buyer sees all categories and can persist an update", async ({ page }) => {
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the standard web/API stack.");
    await loginAsBuyer(page);
    await page.goto("/dashboard/settings/interests");

    await expect(page.getByRole("heading", { name: "Auction interests" }).first()).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(8);
    await expect(page.getByText("Some categories are temporarily unavailable")).toHaveCount(0);

    const art = page.getByRole("checkbox", { name: "Art" });
    const wasChecked = (await art.getAttribute("aria-checked")) === "true";
    try {
      await art.click();
      await page.getByRole("button", { name: "Save interests" }).click();
      await expect(page.getByText("Your auction interests were updated.")).toBeVisible();
      await expect(page.getByRole("checkbox", { name: "Art" })).toHaveAttribute(
        "aria-checked",
        String(!wasChecked),
      );
      await expect(page.getByRole("button", { name: "Save interests" })).toBeDisabled();
    } finally {
      await page.goto("/dashboard/settings/interests");
      const restoredArt = page.getByRole("checkbox", { name: "Art" });
      const isChecked = (await restoredArt.getAttribute("aria-checked")) === "true";
      if (isChecked !== wasChecked) {
        await restoredArt.click();
        await page.getByRole("button", { name: "Save interests" }).click();
        await expect(page.getByText("Your auction interests were updated.")).toBeVisible();
      }
    }
  });
});
