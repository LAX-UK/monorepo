import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const clientEmail = process.env.PLAYWRIGHT_CLIENT_EMAIL ?? "";
const clientPassword = process.env.PLAYWRIGHT_CLIENT_PASSWORD ?? "";

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  next?: string,
) {
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
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    },
  ]);
  const nextQuery = next ? `&next=${encodeURIComponent(next)}` : "";
  await page.goto(`/login?email=${encodeURIComponent(email)}${nextQuery}`);
  const continueButton = page.getByRole("button", { name: /^continue$/i });
  if (await continueButton.isVisible().catch(() => false)) await continueButton.click();
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(dashboard|admin|onboarding\/)/);
}

async function clientLogin(page: import("@playwright/test").Page) {
  await login(page, clientEmail, clientPassword);
}

test.describe("identity onboarding login redirect @journey", () => {
  test("preserves intent without forcing KYC on normal login", async ({ page }) => {
    const email = process.env.PLAYWRIGHT_KYC_LOGIN_EMAIL ?? "";
    const password = process.env.PLAYWRIGHT_KYC_LOGIN_PASSWORD ?? "";
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the web/API stack.");
    test.skip(
      !email || !password,
      "Set PLAYWRIGHT_KYC_LOGIN_EMAIL/PASSWORD to a verified, migration-backfilled client.",
    );

    await login(page, email, password, "/dashboard/watchlist");
    await expect(page).toHaveURL(/\/dashboard\/watchlist(?:\?welcome=back)?$/);
  });
});

test.describe("identity onboarding @journey", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the web/API stack.");
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD.");
    await clientLogin(page);
  });

  test("preserves intent through KYC and allows skip/resume", async ({ page }) => {
    await page.goto("/onboarding/identity?next=%2Fdashboard%2Fwatchlist&source=post_verify");
    await expect(page.getByRole("heading", { name: /verify your identity/i })).toBeVisible();
    await expect(page.getByText(/photo id ready/i).first()).toBeVisible();

    await page.getByRole("link", { name: /verify later|i'll do this later/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/watchlist/);

    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /identity|verification/i }).first()).toBeVisible();
  });

  test("starts the production-like Veriff flow when explicitly enabled", async ({ page }) => {
    test.skip(
      process.env.PLAYWRIGHT_KYC_START !== "1",
      "Set PLAYWRIGHT_KYC_START=1 with a disposable unverified Veriff test user.",
    );
    await page.goto("/onboarding/identity/verify?next=%2Fdashboard&source=direct");
    await page.getByRole("button", { name: /start verification|resume verification/i }).click();
    await expect(
      page.getByText(/verification in progress|complete document and selfie/i),
    ).toBeVisible();
  });

  test("rejects an unsafe next destination", async ({ page }) => {
    await page.goto("/onboarding/identity?next=%2F%2Fevil.example&source=direct");
    await page.getByRole("link", { name: /verify later|i'll do this later/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("full post-verification buyer onboarding @journey", () => {
  test("completes interests, recommendations, watchlist, and KYC handoff with safe next", async ({
    page,
  }) => {
    const entryUrl = process.env.PLAYWRIGHT_FULL_ONBOARDING_ENTRY_URL ?? "";
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the web/API stack.");
    test.skip(
      !entryUrl,
      "Set PLAYWRIGHT_FULL_ONBOARDING_ENTRY_URL to a fresh individual email-verification URL.",
    );

    await page.goto(entryUrl);
    await expect(page).toHaveURL(/\/onboarding\/interests\?.*next=%2Fdashboard%2Fwatchlist/);
    await expect(
      page.getByRole("heading", { name: /what are your areas of interest/i }),
    ).toBeVisible();
    await page.getByRole("checkbox", { name: "Art" }).click();
    await expect(page.getByRole("checkbox", { name: "Art" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: /recommended lots/i })).toBeVisible();
    const watchButton = page.getByRole("button", { name: /add .* to watchlist/i }).first();
    await watchButton.click();
    await expect(watchButton).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("link", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: /one step from bidding on/i })).toBeVisible();
    await page.getByRole("link", { name: /verify later|i'll do this later/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/watchlist/);
  });

  test("skips recommendations when selected categories have zero active lots", async ({ page }) => {
    const email = process.env.PLAYWRIGHT_ZERO_LOT_EMAIL ?? "";
    const password = process.env.PLAYWRIGHT_ZERO_LOT_PASSWORD ?? "";
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the web/API stack.");
    test.skip(
      !email || !password,
      "Set PLAYWRIGHT_ZERO_LOT_EMAIL/PASSWORD to a user whose selected categories have no active lots.",
    );
    await login(page, email, password);

    await page.goto("/onboarding/recommendations?next=%2Fdashboard%2Fwatchlist");
    await expect(page).toHaveURL(/\/onboarding\/identity\?.*next=%2Fdashboard%2Fwatchlist/);
  });
});

test.describe("onboarding eligibility exclusions @roles", () => {
  for (const role of ["staff", "organisation"] as const) {
    test(`${role} login never enters buyer interests or KYC onboarding`, async ({ page }) => {
      const prefix = role === "staff" ? "PLAYWRIGHT_STAFF" : "PLAYWRIGHT_ORG";
      const email = process.env[`${prefix}_EMAIL`] ?? "";
      const password = process.env[`${prefix}_PASSWORD`] ?? "";
      test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the web/API stack.");
      test.skip(!email || !password, `Set ${prefix}_EMAIL/PASSWORD.`);

      await login(page, email, password, "/dashboard/watchlist");
      await expect(page).not.toHaveURL(/\/onboarding\/(?:interests|identity)/);
    });
  }
});
