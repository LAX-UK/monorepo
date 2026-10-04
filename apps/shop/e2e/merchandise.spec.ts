import { expect, test } from "@playwright/test";

test.describe("merchandise catalogue @e2e", () => {
  test("lists acceptance merchandise when enabled", async ({ page }) => {
    test.skip(process.env.PLAYWRIGHT_E2E !== "1", "Set PLAYWRIGHT_E2E=1 for staging catalogue");
    await page.goto("/merchandise");
    const disabled = page.getByText(/not available|coming soon|disabled/i);
    if (
      await disabled
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      test.skip(true, "merchandise disabled on target environment");
    }
    await expect(page.getByText(/acceptance test cap/i)).toBeVisible({ timeout: 15_000 });
  });
});
