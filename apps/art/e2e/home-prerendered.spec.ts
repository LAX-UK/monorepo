import { artE2eEnabled, artE2eSkipReason } from "./helpers/art-e2e";
import { expect, testWithoutSignOut as test } from "./helpers/test";

/**
 * The home page's HTML carries the page itself (docs/design/overnight-decision-pack-2026-11-17.md,
 * item C): every document request for `/` is served from the prerendered copy, which has no
 * loading boundary, so visitors and crawlers without JavaScript see the hero and the sections,
 * never the loading screen. In-app navigation keeps the loading screen (e2e/loading-screens.spec.ts).
 */
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "375", width: 375, height: 812 },
] as const;

const DOCUMENT_HEADERS = { accept: "text/html", "sec-fetch-dest": "document" };

test.describe("lax.art home without JavaScript @smoke", () => {
  test.skip(!artE2eEnabled, artE2eSkipReason);
  test.use({ javaScriptEnabled: false });

  for (const viewport of VIEWPORTS) {
    test(`shows the hero and section titles, not the loading screen, at ${viewport.name}`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "chromium-desktop", "sizes are set by the test");
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");

      await expect(page.locator("#art-home-title")).toBeVisible();
      await expect(page.locator("#art-home-title")).not.toHaveText("");
      const sectionTitles = page.locator("main h2");
      expect(await sectionTitles.count()).toBeGreaterThanOrEqual(3);
      for (const title of await sectionTitles.all()) await expect(title).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: "What's on across LAX" }),
      ).toBeVisible();

      // The route loading screen is never in the HTML, and none of its skeleton blocks is drawn in
      // the first view. (An image's own placeholder, `role="img"`, still shows without JavaScript;
      // that is the separate MediaImage follow-up from #1502.)
      await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
      const skeletonsInView = await page.locator('.lax-skeleton:not([role="img"])').evaluateAll(
        (blocks) =>
          blocks.filter((block) => {
            const box = block.getBoundingClientRect();
            return (
              box.width > 0 && box.height > 0 && box.top < window.innerHeight && box.bottom > 0
            );
          }).length,
      );
      expect(skeletonsInView, "skeleton blocks in the first viewport").toBe(0);
    });
  }
});

test.describe("lax.art prerendered home @smoke", () => {
  test.skip(!artE2eEnabled, artE2eSkipReason);

  test("a direct visit to the prerendered copy goes to the home page", async ({ request }) => {
    const response = await request.get("/prerendered/home", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(new URL(response.headers().location ?? "", "http://lax.invalid").pathname).toBe("/");
  });

  test("the home tag from shop-api makes the next request render the page again", async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "one run is enough");
    const secret = process.env.ART_E2E_REVALIDATE_SECRET;
    test.skip(
      !secret,
      "Set ART_E2E_REVALIDATE_SECRET to the ART_REVALIDATE_SECRET lax.art runs with.",
    );
    const cacheState = async () =>
      (await request.get("/", { headers: DOCUMENT_HEADERS })).headers()["x-nextjs-cache"];

    await cacheState();
    expect(await cacheState()).toBe("HIT");

    const revalidated = await request.post("/api/revalidate", {
      headers: { "x-revalidate-secret": secret ?? "" },
      data: { tags: ["art:home"] },
    });
    expect(revalidated.status()).toBe(204);

    expect(await cacheState()).toBe("MISS");
    expect(await cacheState()).toBe("HIT");
  });
});
