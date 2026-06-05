import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1 and start apps/web (pnpm dev).";

const clientEmail = process.env.PLAYWRIGHT_CLIENT_EMAIL ?? "";
const clientPassword = process.env.PLAYWRIGHT_CLIENT_PASSWORD ?? "";
const financeEmail = process.env.PLAYWRIGHT_FINANCE_EMAIL ?? "";
const financePassword = process.env.PLAYWRIGHT_FINANCE_PASSWORD ?? "";
const orgEntityId = process.env.PLAYWRIGHT_ORG_ENTITY_ID ?? "";
const orgOnboardingEntityId = process.env.PLAYWRIGHT_ORG_ONBOARDING_ENTITY_ID ?? "";

async function loginAs(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

async function clientLogin(page: import("@playwright/test").Page) {
  await loginAs(page, clientEmail, clientPassword);
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

  test("connect workspace shows status header or preparing panel", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");

    await clientLogin(page);
    await page.goto("/dashboard/seller/connect");
    const workspace = page.getByTestId("connect-workspace");
    await expect(workspace).toBeVisible({ timeout: 15_000 });
    const hasStatusOrPreparing = await page
      .getByText(/payout setup|setting up your secure payout account|loading payout setup/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasStatusOrPreparing).toBe(true);
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

test.describe("organisation connect", () => {
  test("org connect tab loads workspace shell", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");
    test.skip(
      !orgEntityId,
      "Set PLAYWRIGHT_ORG_ENTITY_ID to an organisation the client user can access",
    );

    await clientLogin(page);
    await page.goto(`/dashboard/organisations/${orgEntityId}/connect`);
    await expect(page.getByRole("heading", { name: /payout setup/i })).toBeVisible({
      timeout: 15_000,
    });
    const workspace = page.getByTestId("connect-workspace");
    const sliceError = page.getByText(/could not load payout status/i);
    await expect(workspace.or(sliceError)).toBeVisible({ timeout: 15_000 });
  });

  test("org connect tab shows loading skeleton on navigation", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");
    test.skip(!orgEntityId, "Set PLAYWRIGHT_ORG_ENTITY_ID");

    await clientLogin(page);
    await page.goto(`/dashboard/organisations/${orgEntityId}/connect`);
    await expect(
      page
        .getByTestId("connect-page-header-skeleton")
        .or(page.getByTestId("connect-workspace-skeleton"))
        .or(page.getByTestId("connect-workspace")),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("connect role matrix", () => {
  test("finance member sees read-only guidance on org connect", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      !financeEmail || !financePassword || !orgEntityId,
      "Set PLAYWRIGHT_FINANCE_EMAIL, PLAYWRIGHT_FINANCE_PASSWORD, and PLAYWRIGHT_ORG_ENTITY_ID",
    );

    await loginAs(page, financeEmail, financePassword);
    await page.goto(`/dashboard/organisations/${orgEntityId}/connect`);
    await expect(page.getByRole("heading", { name: /payout setup/i })).toBeVisible({
      timeout: 15_000,
    });
    const workspace = page.getByTestId("connect-workspace");
    await expect(workspace).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/owner or admin|refresh status|ask an organisation owner/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("org onboarding connect wizard", () => {
  test("onboarding connect step shows payout setup and continue gate", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");
    test.skip(
      !orgOnboardingEntityId,
      "Set PLAYWRIGHT_ORG_ONBOARDING_ENTITY_ID to an org in connect onboarding step",
    );

    await clientLogin(page);
    await page.goto(
      `/onboarding/organisation/step/connect?entityId=${encodeURIComponent(orgOnboardingEntityId)}`,
    );
    await expect(page.getByRole("heading", { name: /payout setup/i })).toBeVisible({
      timeout: 15_000,
    });
    const continueBtn = page.getByRole("button", { name: /continue to identity verification/i });
    await expect(continueBtn).toBeVisible();
    const helper = page.getByText(/complete payout verification|stripe confirms your account/i);
    const helperVisible = await helper.isVisible().catch(() => false);
    const continueDisabled = await continueBtn.isDisabled();
    expect(helperVisible || continueDisabled).toBe(true);
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
