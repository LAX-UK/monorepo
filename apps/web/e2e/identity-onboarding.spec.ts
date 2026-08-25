import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { roleAuthState } from "./helpers/auth-state";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const visualEnabled = process.env.PLAYWRIGHT_VISUAL === "1";
const onboardingVisual = process.env.PLAYWRIGHT_ONBOARDING_VISUAL === "1";
const fullBuyerOnboarding = process.env.FULL_BUYER_ONBOARDING_ENABLED === "true";

function skipUnlessPrepared(statePath: string, setupName: string): void {
  test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the web/API stack.");
  test.skip(!existsSync(statePath), `Mint ${setupName} via prepare-e2e-auth-states.mjs`);
}

test.describe("identity onboarding login redirect @journey", () => {
  test.use({ storageState: roleAuthState.client });

  test("does not force a completed buyer through KYC on sign-in", async ({ page }) => {
    skipUnlessPrepared(roleAuthState.client, "setup-client");

    await page.goto("/auth/post-login?next=/dashboard/watchlist");

    await expect(page).not.toHaveURL(/\/onboarding\/(?:interests|identity)/);
    await expect(page).toHaveURL(/\/dashboard\/watchlist/);
  });
});

test.describe("incomplete buyer login resume @journey", () => {
  test.use({ storageState: roleAuthState.incomplete });

  test("resumes interests when full buyer onboarding is enabled", async ({ page }) => {
    skipUnlessPrepared(roleAuthState.incomplete, "setup-incomplete");
    test.skip(!fullBuyerOnboarding, "Requires FULL_BUYER_ONBOARDING_ENABLED=true.");

    await page.goto("/auth/post-login?next=/dashboard/watchlist");

    await expect(page).toHaveURL(/\/onboarding\/interests\?.*source=sign_in_resume/);
    await expect(
      page.getByRole("heading", { name: /what are your areas of interest/i }),
    ).toBeVisible();
  });
});

test.describe("identity onboarding @journey", () => {
  test.use({ storageState: roleAuthState.unapproved });

  test.beforeEach(() => {
    skipUnlessPrepared(roleAuthState.unapproved, "setup-unapproved");
  });

  test("preserves intent through KYC and allows skip/resume", async ({ page }) => {
    await page.goto("/onboarding/identity?next=%2Fdashboard%2Fwatchlist&source=post_verify");
    await expect(page.getByRole("heading", { name: /verify your identity/i })).toBeVisible();
    await expect(page.getByText(/photo id ready/i).first()).toBeVisible();

    await page.getByRole("link", { name: /verify later|finish later/i }).click();
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
    await page.getByRole("link", { name: /verify later|finish later/i }).click();
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
    await page.getByRole("link", { name: /verify later|finish later/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/watchlist/);
  });

  test.describe("empty recommendations @journey", () => {
    test.use({ storageState: roleAuthState.zeroLot });

    test("skips recommendations when selected categories have zero active lots", async ({
      page,
    }) => {
      skipUnlessPrepared(roleAuthState.zeroLot, "setup-zero-lot");
      await page.goto("/onboarding/recommendations?next=%2Fdashboard%2Fwatchlist");
      await expect(page).toHaveURL(/\/onboarding\/identity\?.*next=%2Fdashboard%2Fwatchlist/);
    });
  });
});

test.describe("onboarding eligibility exclusions @roles", () => {
  test.describe("staff @roles", () => {
    test.use({ storageState: roleAuthState.staffPublic });

    test("staff login never enters buyer interests or KYC onboarding", async ({ page }) => {
      test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the web/API stack.");
      await page.goto("/auth/post-login?next=/dashboard/watchlist", {
        waitUntil: "domcontentloaded",
      });
      await expect(page).not.toHaveURL(/\/onboarding\/(?:interests|identity)/);
    });
  });

  test.describe("organisation @roles", () => {
    test.use({ storageState: roleAuthState.buyer });

    test("organisation login never enters buyer interests or KYC onboarding", async ({ page }) => {
      test.skip(!enabled, "Set PLAYWRIGHT_E2E=1 and start the web/API stack.");
      test.skip(
        !existsSync(roleAuthState.buyer),
        "Mint setup-buyer via prepare-e2e-auth-states.mjs",
      );
      await page.goto("/auth/post-login?next=/dashboard/watchlist");
      await expect(page).not.toHaveURL(/\/onboarding\/(?:interests|identity)/);
    });
  });
});

test.describe("buyer onboarding visual contracts @visual", () => {
  test.use({ storageState: roleAuthState.unapproved });

  test.beforeEach(async ({ page }) => {
    test.skip(
      !enabled || !visualEnabled || !onboardingVisual,
      "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_VISUAL=1, and PLAYWRIGHT_ONBOARDING_VISUAL=1 after inspecting baselines.",
    );
    skipUnlessPrepared(roleAuthState.unapproved, "setup-unapproved");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
    });
  });

  for (const screen of [
    {
      name: "interests",
      path: "/onboarding/interests?next=%2Fdashboard&source=post_verify",
      heading: /what are your areas of interest/i,
      requiresFullBuyer: true,
    },
    {
      name: "recommendations",
      path: "/onboarding/recommendations?next=%2Fdashboard&source=post_verify",
      heading: /recommended lots/i,
      requiresFullBuyer: true,
    },
    {
      name: "identity",
      path: "/onboarding/identity?next=%2Fdashboard&source=post_verify",
      heading: /verify your identity/i,
      requiresFullBuyer: false,
    },
  ]) {
    test(`${screen.name} desktop Figma screen`, async ({ page }) => {
      test.skip(
        screen.requiresFullBuyer && !fullBuyerOnboarding,
        "Requires FULL_BUYER_ONBOARDING_ENABLED=true.",
      );
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
    test.skip(!fullBuyerOnboarding, "Requires FULL_BUYER_ONBOARDING_ENABLED=true.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/onboarding/interests?next=%2Fdashboard&source=post_verify");
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page).toHaveScreenshot("buyer-onboarding-interests-mobile.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
});
