import { expect, test } from "@playwright/test";
import { artE2eEnabled, artE2eSkipReason } from "./helpers/art-e2e";

/** Mirrors `ART_EDITORIAL_ENABLED` on the Art server; CI seeds the editorial showcase. */
const editorialEnabled = process.env.ART_EDITORIAL_ENABLED === "true";
/** From `art-originals-seed.ts`; carries every spec group, provenance and exhibition history. */
const SEEDED_ORIGINAL_SLUG = "tidal-forms";

test.describe("lax.art discovery", () => {
  test.beforeEach(() => {
    test.skip(!artE2eEnabled, artE2eSkipReason);
  });

  test("grid and list views switch in the URL and persist across visits", async ({ page }) => {
    await page.goto("/artworks");
    test.skip(
      (await page.getByTestId("art-artwork-card").count()) === 0,
      "no art-channel artworks seeded",
    );
    const view = page.getByRole("radiogroup", { name: "View" });

    await view.getByRole("radio", { name: "List" }).click();
    await expect(page).toHaveURL(/[?&]view=list/);
    await expect(page.getByTestId("art-artwork-list")).toBeVisible();
    await expect(page.getByTestId("art-artwork-card")).toHaveCount(0);

    await page.goto("/artworks");
    await expect(page.getByTestId("art-artwork-list")).toBeVisible();
    await expect(view.getByRole("radio", { name: "List" })).toHaveAttribute("aria-checked", "true");

    await view.getByRole("radio", { name: "Grid" }).click();
    await expect(page).not.toHaveURL(/view=/);
    await expect(page.getByTestId("art-artwork-card").first()).toBeVisible();
  });

  test("medium tiles filter the catalogue by object type", async ({ page }) => {
    await page.goto("/artworks");
    const tiles = page.getByTestId("art-object-type-tiles");
    test.skip((await tiles.count()) === 0, "fewer than two art-channel media seeded");
    const first = tiles.getByRole("link").first();
    await first.click();
    await expect(page).toHaveURL(/\/(paintings|prints|sculptures)(\?|$)|[?&]objectType=/);
    await expect(
      page.getByTestId("art-object-type-tiles").locator('[aria-current="true"]'),
    ).toHaveCount(1);
  });

  test("artwork detail groups specs in accordions and offers share", async ({ page }) => {
    const response = await page.goto(`/artworks/${SEEDED_ORIGINAL_SLUG}`);
    test.skip(response?.status() === 404, "art originals seed not applied");

    const sections = page.getByTestId("art-artwork-detail-sections");
    await expect(sections).toBeVisible();
    const firstTrigger = sections.getByRole("button", { expanded: true }).first();
    await expect(firstTrigger).toBeVisible();
    await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
  });

  test("unknown slugs render the not-found page", async ({ page }) => {
    test.slow();
    const paths = ["/artworks/zzqx-missing", "/artists/zzqx-missing"];
    if (editorialEnabled) {
      paths.push("/exhibitions/zzqx-missing", "/visit/zzqx-missing", "/collector-hub/zzqx-missing");
    }
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    }
  });

  test("guides have canonical routes and legal aliases redirect to them", async ({ page }) => {
    test.skip(!editorialEnabled, "editorial pages need ART_EDITORIAL_ENABLED=true");
    await page.goto("/how-to-buy");
    await expect(page.getByRole("heading", { level: 1, name: "How to buy" })).toBeVisible();

    await page.goto("/legal/how-to-buy");
    await expect(page).toHaveURL(/\/how-to-buy$/);

    // The guide opens with the Figma page title band, which has no visual breadcrumb.
    await page.goto("/collector-hub/101-guide");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("visit lists venues that open their own page", async ({ page }) => {
    test.skip(!editorialEnabled, "venues need ART_EDITORIAL_ENABLED=true");
    await page.goto("/visit");
    const card = page.getByTestId("art-venue-card").first();
    test.skip((await card.count()) === 0, "no venues seeded");
    const name = (await card.getByRole("heading", { level: 2 }).textContent())?.trim() ?? "";
    await expect(card.locator("a[aria-hidden]")).toHaveCount(0);
    await card.getByRole("heading", { level: 2 }).getByRole("link").click();
    await expect(page).toHaveURL(/\/visit\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Book a private viewing" })).toBeVisible();
  });

  test("exhibitions feature current and upcoming shows above the tabs", async ({ page }) => {
    test.skip(!editorialEnabled, "exhibitions need ART_EDITORIAL_ENABLED=true");
    await page.goto("/exhibitions?status=past");
    const featured = page.getByRole("region", { name: "Featured" });
    test.skip((await featured.count()) === 0, "no featured exhibitions seeded");
    await expect(featured.getByTestId("art-editorial-card").first()).toBeVisible();
  });
});
