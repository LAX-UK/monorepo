import { describe, expect, it } from "vitest";
import { legacyThelaxFixture } from "../../test-support/legacy-thelax-fixture.js";
import { parseLegacyThelaxExport } from "./legacy-thelax-export.js";
import { buildLegacyRedirects, plannedArtworkSlugs } from "./legacy-thelax-redirects.js";

describe("legacy thelax redirects", () => {
  const data = parseLegacyThelaxExport(legacyThelaxFixture("x"));

  it("maps every family to one closest-equivalent target", () => {
    const redirects = buildLegacyRedirects(data, {
      artworkSlugs: plannedArtworkSlugs(data.artworks),
      imageUrls: new Map([["/uds/stock/x-flower.jpg", "https://cdn.test/shop/artwork/a.jpg"]]),
    });
    expect(redirects).toMatchObject({
      "/collection/x-flower.html": "/artworks/x-flower",
      "/print/x-flower.html": "/artworks/x-flower-print",
      "/collections/x-ada.html": "/artists/x-ada",
      "/collections/x-bo.html": "/artists/x-bo",
      "/art-collection/x-blooms.html": "/artists/x-ada",
      "/art-collection/x-misc.html": "/artworks",
      "/art-style/x-surrealism.html": "/collector-hub/style-x-surrealism",
      "/news/x-story.html": "/stories/x-story",
      "/faq": "/collector-hub/faq",
      "/contact-us": "/contact",
      "/prev-auction": "https://lax.bid/archive",
      "/uds/stock/x-flower.jpg": "https://cdn.test/shop/artwork/a.jpg",
    });
    // Page and legal targets need imported content; route targets always exist.
    expect(redirects).not.toHaveProperty("/privacy-policy");
    expect(redirects).not.toHaveProperty("/paintings");
    expect(redirects).not.toHaveProperty("/site-map");
    expect(Object.values(redirects)).not.toContain("/");
  });

  it("applies path overrides last, for URLs the crawl cannot see", () => {
    const redirects = buildLegacyRedirects(data, {
      artworkSlugs: plannedArtworkSlugs(data.artworks),
      overrides: {
        "/collection/x-old-listing.html": "/artworks/x-flower",
        "/faq": "/contact",
      },
    });
    expect(redirects["/collection/x-old-listing.html"]).toBe("/artworks/x-flower");
    expect(redirects["/faq"]).toBe("/contact");
  });

  it("omits artworks that were not imported so they 404 honestly", () => {
    const redirects = buildLegacyRedirects(data, {
      artworkSlugs: new Map([["/collection/x-flower.html", "x-flower"]]),
    });
    expect(redirects).not.toHaveProperty("/collection/x-taken.html");
    expect(redirects["/collection/x-flower.html"]).toBe("/artworks/x-flower");
  });

  it("rejects an export with the wrong schema version", () => {
    expect(() =>
      parseLegacyThelaxExport({ ...legacyThelaxFixture("x"), schemaVersion: 2 }),
    ).toThrow(/Invalid legacy thelax export/);
  });
});
