import { expect, test } from "@playwright/test";

const enabled =
  process.env.PLAYWRIGHT_E2E === "1" && process.env.PLAYWRIGHT_MARKETING_PROMPTS === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_MARKETING_PROMPTS=1, and run web with MARKETING_PROMPTS_ENABLED=true.";

const sessionKey = "lax_marketing_prompt_session_v1";

async function seedPromptSession(
  page: import("@playwright/test").Page,
  {
    activeDwellMs,
    eligiblePageViews,
    lastEligiblePath,
    sellingIntentTrigger,
  }: {
    activeDwellMs: number;
    eligiblePageViews: number;
    lastEligiblePath: string | null;
    sellingIntentTrigger: "sell-content" | null;
  },
) {
  await page.addInitScript(
    ({ key, session }) => {
      window.sessionStorage.setItem(key, JSON.stringify(session));
      window.localStorage.removeItem("lax_marketing_prompt_suppression_v1:selling");
      window.localStorage.removeItem("lax_marketing_prompt_suppression_v1:signup");
    },
    {
      key: sessionKey,
      session: {
        activeDwellMs,
        eligiblePageViews,
        lastEligiblePath,
        shownVariant: null,
        sellingIntentTrigger,
      },
    },
  );
}

async function navigateToArtists(page: import("@playwright/test").Page) {
  const mobileMenu = page.getByRole("button", { name: "Open menu" });
  if (await mobileMenu.isVisible()) {
    await mobileMenu.click();
    const drawer = page.getByRole("dialog", { name: "Site navigation" });
    await drawer.getByRole("button", { name: "Artists", exact: true }).click();
    await drawer.locator('a[href="/artists"]').click();
  } else {
    await page.getByRole("button", { name: "Artists", exact: true }).click();
    await page.locator('.header-megamenu a[href="/artists"]').click();
  }
  await expect(page).toHaveURL(/\/artists$/);
}

test.describe("contextual marketing prompts", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test("selling prompt waits for navigation and matches desktop split layout", async ({
    page,
  }, testInfo) => {
    test.skip(!enabled, skipReason);
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedPromptSession(page, {
      activeDwellMs: 15_000,
      eligiblePageViews: 0,
      lastEligiblePath: null,
      sellingIntentTrigger: "sell-content",
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("dialog", { name: "Have something special to sell?" })).toHaveCount(
      0,
    );

    await navigateToArtists(page);
    const dialog = page.getByRole("dialog", { name: "Have something special to sell?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Explore selling" })).toHaveAttribute(
      "href",
      /\/register\?.*intent=sell/,
    );
    await expect(dialog.locator("img")).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box?.width).toBeGreaterThan(850);
    expect(box?.height).toBeGreaterThan(400);

    await testInfo.attach("selling-prompt-desktop", {
      body: await page.screenshot(),
      contentType: "image/png",
    });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("signup prompt is compact and bottom-docked on mobile", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    await page.setViewportSize({ width: 375, height: 812 });
    await seedPromptSession(page, {
      activeDwellMs: 45_000,
      eligiblePageViews: 2,
      lastEligiblePath: "/search",
      sellingIntentTrigger: null,
    });

    await page.goto("/search", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("dialog", { name: "Discover art worth collecting" })).toHaveCount(
      0,
    );

    await navigateToArtists(page);
    const dialog = page.getByRole("dialog", { name: "Discover art worth collecting" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      /\/register\?next=/,
    );
    await expect(dialog.getByRole("link", { name: "Sign in" })).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box?.x).toBeLessThanOrEqual(1);
    expect(box?.width).toBeGreaterThanOrEqual(373);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThanOrEqual(810);

    await testInfo.attach("signup-prompt-mobile", {
      body: await page.screenshot(),
      contentType: "image/png",
    });

    await page.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  });
});
