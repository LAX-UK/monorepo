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
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Landings drop the tile rail; media without a landing keep it on `/artworks`.
    if (!page.url().includes("objectType=")) {
      await expect(page.getByTestId("art-object-type-tiles")).toHaveCount(0);
    }
  });

  test("toolbar dropdown applies several mediums and resets the cursor", async ({ page }) => {
    await page.goto("/artworks?cursor=stale");
    const medium = page.getByRole("button", { name: /^Medium/ });
    test.skip((await medium.count()) === 0, "medium facet unavailable");
    await medium.click();
    const panel = page.getByRole("dialog");
    const boxes = panel.getByRole("checkbox");
    test.skip((await boxes.count()) < 2, "fewer than two media seeded");
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await panel.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/objectType=[^&]+(%2C|,)[^&]+/);
    await expect(page).not.toHaveURL(/cursor=/);
  });

  test("filters drawer opens on desktop, sorts via radio and cancels without navigating", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "the right-hand drawer is desktop-only",
    );
    await page.goto("/artworks");
    await page
      .getByRole("button", { name: /^Filters/ })
      .first()
      .click();
    const drawer = page.getByRole("dialog", { name: "Filters" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("radio", { name: "Title (A–Z)" }).check();
    await drawer.getByRole("button", { name: "Cancel" }).click();
    await expect(page).not.toHaveURL(/sort=/);

    await page
      .getByRole("button", { name: /^Filters/ })
      .first()
      .click();
    await drawer.getByRole("radio", { name: "Title (A–Z)" }).check();
    await drawer.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/sort=title/);
  });

  test("artwork detail shows the description directly and offers share", async ({ page }) => {
    const response = await page.goto(`/artworks/${SEEDED_ORIGINAL_SLUG}`);
    test.skip(response?.status() === 404, "art originals seed not applied");

    const sections = page.getByTestId("art-artwork-detail-sections");
    await expect(sections).toBeVisible();
    await expect(sections.getByTestId("art-artwork-description")).toBeVisible();
    // Desktop shares from the title row ("Share {title}"), phones from the gallery ("Share").
    await expect(
      page
        .getByRole("button", { name: /^Share/ })
        .locator("visible=true")
        .first(),
    ).toBeVisible();
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

  test("help search finds a question and opens its answer", async ({ page }) => {
    test.skip(!editorialEnabled, "the Help centre needs ART_EDITORIAL_ENABLED=true");
    await page.goto("/help");
    const firstQuestion = page.locator("main a[href^='/help/']").first();
    test.skip((await firstQuestion.count()) === 0, "no help content seeded");

    await page.getByRole("searchbox", { name: "Search the Help centre" }).fill("deliver");
    await page.locator("main").getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/help\?q=deliver/);
    await expect(
      page.getByRole("heading", { level: 2, name: /results? for “deliver”/ }),
    ).toBeVisible();

    const result = page.locator("main a[href^='/help/']").first();
    const question = (await result.locator("span").first().textContent())?.trim() ?? "";
    await result.click();
    await expect(page).toHaveURL(/\/help\/[^/?]+$/);
    await expect(page.getByRole("heading", { level: 1, name: question })).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Contact us" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  test("help search says so when nothing matches", async ({ page }) => {
    test.skip(!editorialEnabled, "the Help centre needs ART_EDITORIAL_ENABLED=true");
    await page.goto("/help?q=zzqx-no-such-question-9271");
    await expect(page.getByRole("heading", { level: 2, name: /No results for/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse all questions" })).toBeVisible();
  });

  test("visit lists venues that open their own page", async ({ page }) => {
    test.skip(!editorialEnabled, "venues need ART_EDITORIAL_ENABLED=true");
    await page.goto("/visit");
    const card = page.getByTestId("art-venue-card").first();
    test.skip((await card.count()) === 0, "no venues seeded");
    const name = (await card.getByRole("heading", { level: 3 }).textContent())?.trim() ?? "";
    await expect(
      page.getByRole("heading", { level: 2, name: /^Our galler(y|ies)$/ }),
    ).toBeVisible();
    await card.getByRole("link").click();
    await expect(page).toHaveURL(/\/visit\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Book a private viewing" })).toBeVisible();
  });

  test("exhibitions open with a featured hero above the date tabs", async ({ page }) => {
    test.skip(!editorialEnabled, "exhibitions need ART_EDITORIAL_ENABLED=true");
    await page.goto("/exhibitions?status=past");
    await expect(page.getByRole("heading", { level: 1, name: "Exhibitions" })).toBeAttached();
    const featured = page.getByRole("region", { name: "Featured exhibitions" });
    test.skip((await featured.count()) === 0, "no featured exhibitions seeded");
    await expect(featured.getByRole("link", { name: "View exhibition" }).first()).toBeVisible();
  });

  test("stories tabs are routes and the podcast tab has a playable lead", async ({ page }) => {
    test.skip(!editorialEnabled, "stories need ART_EDITORIAL_ENABLED=true");
    await page.goto("/stories");
    const tabs = page.getByRole("navigation", { name: "Story types" });
    await expect(tabs.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: "Press" }).click();
    await expect(page).toHaveURL(/\/stories\/press$/);
    await tabs.getByRole("link", { name: "LAX's Podcast" }).click();
    await expect(page).toHaveURL(/\/stories\/podcast$/);
    const play = page.getByRole("button", { name: /^Play / });
    test.skip((await play.count()) === 0, "no podcast episode with audio seeded");
    // Serve one second of silence so playback never depends on the media host being reachable.
    await page.route(/\.(mp3|m4a|wav|ogg)(\?.*)?$/, (route) =>
      route.fulfill({ contentType: "audio/wav", body: silentWav(1) }),
    );
    await play.click();
    await expect(page.getByRole("button", { name: /^Pause / })).toBeVisible();
  });
});

/** A mono 8 kHz PCM WAV of silence, enough for the audio element to load and play. */
function silentWav(seconds: number): Buffer {
  const sampleRate = 8000;
  const dataBytes = sampleRate * seconds;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataBytes, 40);
  wav.fill(128, 44);
  return wav;
}
