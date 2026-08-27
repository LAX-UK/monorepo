import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectNoSeriousAxeViolationsInMain } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const fullBuyerOnboarding = process.env.FULL_BUYER_ONBOARDING_ENABLED === "true";

test.describe("buyer onboarding a11y @a11y", () => {
  test.use({ storageState: roleAuthState.unapproved });

  test.beforeEach(() => {
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the web/API stack.");
    test.skip(
      !existsSync(roleAuthState.unapproved),
      "Mint setup-unapproved via prepare-e2e-auth-states.mjs",
    );
  });

  test("identity why page has no serious axe violations and is keyboard reachable", async ({
    page,
  }) => {
    await page.goto("/onboarding/identity?next=%2Fdashboard&source=post_verify");
    await expect(page.getByRole("heading", { name: /verify your identity/i })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);

    const skip = page.getByRole("link", { name: /verify later|finish later/i });
    await skip.focus();
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("identity why page keeps semantic tokens in dark mode", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "lax_theme",
        value: "dark",
        url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
      },
    ]);
    await page.goto("/onboarding/identity?next=%2Fdashboard&source=post_verify");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("heading", { name: /verify your identity/i })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("interests page is labelled and axe-clean when full onboarding is on", async ({ page }) => {
    test.skip(!fullBuyerOnboarding, "Requires FULL_BUYER_ONBOARDING_ENABLED=true.");
    await page.goto("/onboarding/interests?next=%2Fdashboard&source=post_verify");
    await expect(
      page.getByRole("heading", { name: /what are your areas of interest/i }),
    ).toBeVisible();
    await expect(page.getByRole("group", { name: /choose your areas of interest/i })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Art" })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("recommendations page is axe-clean when full onboarding is on", async ({ page }) => {
    test.skip(!fullBuyerOnboarding, "Requires FULL_BUYER_ONBOARDING_ENABLED=true.");
    await page.goto("/onboarding/recommendations?next=%2Fdashboard&source=post_verify");
    await expect(page.getByRole("heading", { name: /recommended lots/i })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });
});
