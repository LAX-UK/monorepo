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
import { clientSession } from "./helpers/auth";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1 and start apps/web (pnpm dev).";

const clientEmail = process.env.PLAYWRIGHT_CLIENT_EMAIL ?? "";
const clientPassword = process.env.PLAYWRIGHT_CLIENT_PASSWORD ?? "";

test.describe("sell funnel smoke @journey", () => {
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
    const submitCtas = page.getByRole("link", { name: /start your submission/i });
    await expect(submitCtas).toHaveCount(2);
    await expect(submitCtas.first()).toHaveAttribute("href", /^\/dashboard\/submissions\/new/);
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
    await expect(page.getByRole("link", { name: /watches & clocks/i })).toHaveAttribute(
      "href",
      "/sell/watches",
    );
    await expect(page.getByRole("link", { name: /prints & editions/i })).toHaveAttribute(
      "href",
      "/sell/prints",
    );
  });

  test("/sell/estate landing routes its CTA into the submission wizard", async ({ page }) => {
    test.skip(!enabled, skipReason);

    const res = await page.goto("/sell/estate");
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: /estate & collections/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /start your submission/i })).toHaveAttribute(
      "href",
      /^\/dashboard\/submissions\/new/,
    );
  });

  test("login with intent=sell hands off to hosted sign-up", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await page.goto("/login?next=/dashboard/submissions/new&intent=sell");
    await page.waitForURL(/\/sign-up\?/, { timeout: 30_000, waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).searchParams.get("client_id")).toBe("lax-bid-web");
  });

  test("authenticated user can open new submission wizard", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      !clientEmail || !clientPassword,
      "Set PLAYWRIGHT_CLIENT_EMAIL and PLAYWRIGHT_CLIENT_PASSWORD",
    );

    await clientSession(page);
    await page.goto("/dashboard/submissions/new");

    await expect(page.getByTestId("submission-wizard-step-basics")).toBeVisible({
      timeout: 15_000,
    });
  });
});
