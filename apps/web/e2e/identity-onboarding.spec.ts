import { expect, test } from "@playwright/test";
import { roleAuthState } from "./helpers/auth-state";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const visualEnabled = process.env.PLAYWRIGHT_VISUAL === "1";
const clientEmail = process.env.PLAYWRIGHT_CLIENT_EMAIL ?? "";
const clientPassword = process.env.PLAYWRIGHT_CLIENT_PASSWORD ?? "";

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  next?: string,
) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(dashboard|admin|onboarding\/)/);
}

async function clientLogin(page: import("@playwright/test").Page) {
  await login(page, clientEmail, clientPassword);
}

test.describe("identity onboarding login redirect @journey", () => {
  test("redirects a verified unapproved client and preserves intent", async ({ page }) => {
    const email = process.env.PLAYWRIGHT_KYC_LOGIN_EMAIL ?? "";
    const password = process.env.PLAYWRIGHT_KYC_LOGIN_PASSWORD ?? "";
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the web/API stack.");
    test.skip(
      !email || !password,
      "Set PLAYWRIGHT_KYC_LOGIN_EMAIL/PASSWORD to a verified unapproved client.",
    );

    await login(page, email, password, "/dashboard/watchlist");

    await expect(page).toHaveURL(
      /\/onboarding\/identity\?next=%2Fdashboard%2Fwatchlist(?:%3Fwelcome%3Dback)?&source=sign_in/,
    );
    await expect(page.getByRole("heading", { name: /verify your identity/i })).toBeVisible();
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

    await page.getByRole("link", { name: /i'll do this later/i }).click();
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
    await page.getByRole("link", { name: /i'll do this later/i }).click();
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
    await page.getByRole("link", { name: /i'll do this later/i }).click();
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
  test.describe("staff @roles", () => {
    test.use({ storageState: roleAuthState.staff });

    test("staff login never enters buyer interests or KYC onboarding", async ({ page }) => {
      test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the web/API stack.");
      await page.goto("/dashboard/watchlist", { waitUntil: "domcontentloaded" });
      await expect(page).not.toHaveURL(/\/onboarding\/(?:interests|identity)/);
    });
  });

  test("organisation login never enters buyer interests or KYC onboarding", async ({ page }) => {
    const email = process.env.PLAYWRIGHT_ORG_EMAIL ?? "";
    const password = process.env.PLAYWRIGHT_ORG_PASSWORD ?? "";
    test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the web/API stack.");
    test.skip(!email || !password, "Set PLAYWRIGHT_ORG_EMAIL/PASSWORD.");
    await login(page, email, password, "/dashboard/watchlist");
    await expect(page).not.toHaveURL(/\/onboarding\/(?:interests|identity)/);
  });
});

test.describe("buyer onboarding visual contracts @visual", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !enabled || !visualEnabled || !clientEmail || !clientPassword,
      "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_VISUAL=1, and client credentials.",
    );
    await clientLogin(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
    });
  });

  for (const screen of [
    {
      name: "interests",
      path: "/onboarding/interests?next=%2Fdashboard",
      heading: /what are your areas of interest/i,
    },
    {
      name: "recommendations",
      path: "/onboarding/recommendations?next=%2Fdashboard",
      heading: /recommended lots/i,
    },
    {
      name: "identity",
      path: "/onboarding/identity?next=%2Fdashboard&source=post_verify",
      heading: /verify your identity/i,
    },
  ]) {
    test(`${screen.name} desktop Figma screen`, async ({ page }) => {
      await page.goto(screen.path);
      await expect(page.locator("#main-content")).toBeVisible();
      await expect(page.getByRole("heading", { name: screen.heading })).toBeVisible();
      await expect(page).toHaveScreenshot(`buyer-onboarding-${screen.name}-desktop.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    });
  }

  test("interests representative mobile screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/onboarding/interests?next=%2Fdashboard");
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page).toHaveScreenshot("buyer-onboarding-interests-mobile.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
});
