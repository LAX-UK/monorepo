/**
 * Sell With Us funnel smoke tests.
 *
 * Requires:
 *   PLAYWRIGHT_E2E=1
 *   PLAYWRIGHT_BASE_URL
 *   Optional: PLAYWRIGHT_CLIENT_EMAIL / PLAYWRIGHT_CLIENT_PASSWORD for auth handoff
 *
 * Run: PLAYWRIGHT_E2E=1 pnpm --filter @auction/web test:e2e -- e2e/sell-funnel-smoke.spec.ts
 */
import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1 and start apps/web (pnpm dev).";

const clientEmail = process.env.PLAYWRIGHT_CLIENT_EMAIL ?? "";
const clientPassword = process.env.PLAYWRIGHT_CLIENT_PASSWORD ?? "";

test.describe("sell funnel smoke", () => {
  test("/sell exposes LegalPage intro, toc sections, and primary CTA", async ({ page }) => {
    test.skip(!enabled, skipReason);

    const res = await page.goto("/sell");
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /selling with lax\.bid/i, level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /what we accept/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /prepare your submission/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /start your submission/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /start submission/i })).toBeVisible();
  });

  test("/sell#departments exposes department grid", async ({ page }) => {
    test.skip(!enabled, skipReason);

    const res = await page.goto("/sell#departments");
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: /what we accept/i })).toBeVisible();
    await expect(page.getByTestId("sell-department-watches-clocks")).toBeVisible();
    await expect(page.getByTestId("sell-department-motor-cars")).toBeVisible();
  });

  test("mega menu sell column links to departments and vertical landings", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await page.goto("/");
    await page.getByRole("button", { name: /^sell$/i }).hover();
    await expect(page.getByRole("link", { name: /what we accept/i })).toHaveAttribute(
      "href",
      "/sell#departments",
    );
    await expect(page.getByRole("link", { name: /sell watches/i })).toHaveAttribute(
      "href",
      "/sell/watches",
    );
    await expect(page.getByRole("link", { name: /prints & editions/i })).toHaveAttribute(
      "href",
      "/sell/prints",
    );
  });

  test("/sell/estate landing exposes specialist and submit CTAs", async ({ page }) => {
    test.skip(!enabled, skipReason);

    const res = await page.goto("/sell/estate");
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: /estate & collections/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /speak to a specialist/i })).toBeVisible();
  });

  test("login with intent=sell shows consignment handoff banner", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await page.goto("/login?next=/dashboard/submissions/new&intent=sell");
    await expect(page.getByText(/consignment submission/i)).toBeVisible();
    await expect(page.getByText(/about 3 minutes/i)).toBeVisible();
  });

  test("authenticated user can open new submission wizard", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      !clientEmail || !clientPassword,
      "Set PLAYWRIGHT_CLIENT_EMAIL and PLAYWRIGHT_CLIENT_PASSWORD",
    );

    await page.goto("/login?next=/dashboard/submissions/new&intent=sell");
    await page.getByLabel(/email/i).fill(clientEmail);
    await page.getByLabel(/password/i).fill(clientPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard\/submissions\/new/);

    await expect(page.getByTestId("submission-wizard-step-basics")).toBeVisible({
      timeout: 15_000,
    });
  });
});
