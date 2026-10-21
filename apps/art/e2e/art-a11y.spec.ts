import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { artE2eEnabled, artE2eSkipReason, firstArtworkHref } from "./helpers/art-e2e";

const BLOCKING_IMPACTS = ["critical", "serious", "moderate"];

async function expectNoBlockingViolations(page: import("@playwright/test").Page) {
  const axe = await new AxeBuilder({ page })
    .include("#main-content")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ""))).toEqual([]);
}

test.describe("lax.art accessibility @a11y", () => {
  test.beforeEach(() => {
    test.skip(!artE2eEnabled, artE2eSkipReason);
  });

  for (const route of [
    // Home h1 is the editorial hero headline when one is placed.
    {
      path: "/",
      heading: process.env.ART_EDITORIAL_ENABLED === "true" ? "" : "Art For a New Generation",
    },
    { path: "/artworks", heading: "Artworks" },
    { path: "/search", heading: "Search" },
    { path: "/search?q=zzqx-no-such-artwork-9271", heading: "Results for" },
    { path: "/artworks?view=list", heading: "Artworks" },
    { path: "/artists", heading: "Artists" },
    { path: "/exhibitions", heading: "Exhibitions", editorial: true },
    { path: "/art-hub", heading: "Art Hub", editorial: true },
    { path: "/collector-hub", heading: "Collector Hub", editorial: true },
    { path: "/visit", heading: "LAX's Locations", editorial: true },
    { path: "/how-to-buy", heading: "How to buy", editorial: true },
  ]) {
    test(`${route.path} has no blocking axe violations in #main-content`, async ({ page }) => {
      test.skip(
        Boolean(route.editorial) && process.env.ART_EDITORIAL_ENABLED !== "true",
        "editorial pages need ART_EDITORIAL_ENABLED=true",
      );
      const response = await page.goto(route.path);
      expect(response?.ok()).toBeTruthy();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(route.heading);
      await expectNoBlockingViolations(page);
    });
  }

  test("artwork detail has no blocking axe violations", async ({ page }) => {
    const seeded = await page.goto("/artworks/tidal-forms");
    if (seeded?.status() === 404) {
      const href = await firstArtworkHref(page);
      test.skip(!href, "no art-channel artworks seeded");
      await page.goto(href as string);
    }
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoBlockingViolations(page);
  });
});
