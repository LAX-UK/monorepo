import type { Locator, Page } from "@playwright/test";
import { type VisualCapture, adminVisualCases, visualVariants } from "./admin-visual-cases";
import {
  assertAdminRouteReady,
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  gotoAdminPath,
  hasStaffCredentials,
  stabilizeVisualPage,
} from "./helpers/auth";
import { expect, test } from "./helpers/auth.fixture";
import { DEMO_VISUAL_NOW } from "./helpers/demo-seed-clock";

const visualEnabled = process.env.PLAYWRIGHT_VISUAL === "1";
const canRunVisual = e2eEnabled && visualEnabled && hasStaffCredentials();
const visualTimeout = 30_000;

const adminHomeCase = adminVisualCases.find((visualCase) => visualCase.slug === "admin-home");
const otherAdminVisualCases = adminVisualCases.filter(
  (visualCase) => visualCase.slug !== "admin-home",
);

async function prepareCase(
  page: Page,
  visualCase: (typeof adminVisualCases)[number],
): Promise<void> {
  const response = await gotoAdminPath(page, visualCase.path);
  expect(response?.ok()).toBeTruthy();
  await assertAdminRouteReady(page);
  await dismissStaffPaletteIfOpen(page);

  if (visualCase.setup === "client-drawer") {
    await dismissStaffPaletteIfOpen(page);
    const drawer = page
      .getByRole("dialog")
      .filter({ hasText: /Robert Thorne|Victoria Harrington|Overview/i });
    if (!(await drawer.isVisible().catch(() => false))) {
      const clientName = page.getByRole("button", { name: /^robert thorne$/i }).first();
      if (await clientName.isVisible().catch(() => false)) {
        await clientName.click();
      }
    }
    await expect(drawer).toBeVisible({ timeout: visualTimeout });
  }

  if (visualCase.setup === "lot-filters") {
    const filters = page.getByRole("button", { name: /^filters$/i });
    await expect(filters).toBeVisible({ timeout: visualTimeout });
    await filters.click();
    await expect(page.getByRole("dialog").filter({ hasText: /apply filters/i })).toBeVisible({
      timeout: visualTimeout,
    });
  }

  if (visualCase.heading) {
    await expect(page.getByRole("heading", { name: visualCase.heading }).first()).toBeVisible({
      timeout: visualTimeout,
    });
  }
}

function captureTarget(page: Page, capture: VisualCapture): Page | Locator {
  if (capture === "main") return page.locator("#main-content");
  if (capture === "dialog") return page.getByRole("dialog").last();
  return page;
}

function adminHomeMasks(page: Page): Locator[] {
  return [
    page.getByText(/need attention/i),
    page.getByLabel("Key metrics"),
    page.getByLabel("List summary"),
  ];
}

function adminLotsMasks(page: Page): Locator[] {
  return [
    page.getByRole("tablist"),
    page.locator("table"),
    page.getByRole("searchbox"),
    page.getByRole("navigation"),
    page.locator("#main-content section").first(),
  ];
}

function screenshotOptions(page: Page, visualCase: (typeof adminVisualCases)[number]) {
  return {
    ...(visualCase.capture === "page" ? { fullPage: true } : {}),
    maxDiffPixelRatio: visualCase.slug === "admin-lots" ? 0.03 : 0.01,
    mask: [
      page.locator("time"),
      page.getByRole("heading", { name: /good day|your dashboard/i }),
      ...(visualCase.slug === "admin-home" ? adminHomeMasks(page) : []),
      ...(visualCase.slug === "admin-lots" ? adminLotsMasks(page) : []),
    ],
  };
}

async function runVisualCase(
  page: Page,
  visualCase: (typeof adminVisualCases)[number],
  variantId: keyof typeof visualVariants,
): Promise<void> {
  const variant = visualVariants[variantId];
  await page.setViewportSize({ width: variant.width, height: variant.height });
  await page.emulateMedia({
    colorScheme: variant.colorScheme,
    reducedMotion: "reduce",
  });

  await page.clock.install({ time: DEMO_VISUAL_NOW });

  await prepareCase(page, visualCase);
  await stabilizeVisualPage(page);
  await page.evaluate(() => document.fonts.ready);

  const target = captureTarget(page, visualCase.capture);
  await expect(target).toHaveScreenshot(
    `${visualCase.slug}-${variantId}.png`,
    screenshotOptions(page, visualCase),
  );
}

test.describe("admin home visual gate @visual", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(90_000);
  test.skip(
    !canRunVisual || !adminHomeCase,
    "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_VISUAL=1, and seeded staff credentials.",
  );

  if (adminHomeCase) {
    for (const variantId of adminHomeCase.variants) {
      test(`${adminHomeCase.slug} ${variantId}`, async ({ page }) => {
        await runVisualCase(page, adminHomeCase, variantId);
      });
    }
  }
});

test.describe("curated admin visual gate @visual", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);
  test.skip(
    !canRunVisual,
    "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_VISUAL=1, and seeded staff credentials.",
  );

  for (const visualCase of otherAdminVisualCases) {
    for (const variantId of visualCase.variants) {
      test(`${visualCase.slug} ${variantId}`, async ({ page }) => {
        await runVisualCase(page, visualCase, variantId);
      });
    }
  }
});
