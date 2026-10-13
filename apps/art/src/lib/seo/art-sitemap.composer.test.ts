import { artistSummary, artworkSummary, fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { composeArtSitemap } from "./art-sitemap.composer";

const SITE = new URL("https://www.thelax.art/");

describe("composeArtSitemap", () => {
  it("pages through the catalogue and adds editorial URLs with lastmod", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks
      .mockResolvedValueOnce({
        items: [artworkSummary({ slug: "bloom", updatedAt: "2026-02-01T00:00:00.000Z" })],
        nextCursor: "c2",
      })
      .mockResolvedValueOnce({ items: [artworkSummary({ slug: "sold-work", saleState: "sold" })] });
    services.catalogue.listArtists.mockResolvedValue({ items: [artistSummary()] });
    services.editorial.listStories.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            slug: "news",
            kind: "article",
            title: "News",
            standfirst: null,
            coverUrl: null,
            featured: false,
            updatedAt: "2026-03-01T00:00:00.000Z",
          },
        ],
      },
    });
    services.editorial.listPages.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          { slug: "faq", title: "FAQ", updatedAt: "2026-04-01T00:00:00.000Z" },
          { slug: "privacy", title: "Privacy", updatedAt: "2026-04-02T00:00:00.000Z" },
          { slug: "how-to-buy", title: "How to buy", updatedAt: "2026-04-03T00:00:00.000Z" },
        ],
      },
    });

    const sitemap = await composeArtSitemap(services, SITE);
    const byUrl = new Map(sitemap.map((entry) => [entry.url, entry]));

    expect(services.catalogue.listArtworks).toHaveBeenLastCalledWith({ limit: 50, cursor: "c2" });
    expect(byUrl.get("https://www.thelax.art/artworks/bloom")?.lastModified).toBe(
      "2026-02-01T00:00:00.000Z",
    );
    expect(byUrl.has("https://www.thelax.art/artworks/sold-work")).toBe(true);
    expect(byUrl.has("https://www.thelax.art/artists/flora-powers")).toBe(true);
    expect(byUrl.get("https://www.thelax.art/stories/news")?.lastModified).toBe(
      "2026-03-01T00:00:00.000Z",
    );
    expect(byUrl.has("https://www.thelax.art/collector-hub/faq")).toBe(true);
    expect(byUrl.has("https://www.thelax.art/legal/privacy")).toBe(true);
    expect(byUrl.has("https://www.thelax.art/how-to-buy")).toBe(true);
    expect(byUrl.has("https://www.thelax.art/paintings")).toBe(true);
    expect([...byUrl.keys()].some((url) => url.includes("/search"))).toBe(false);
  });

  it("drops only the family whose source fails", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockRejectedValue(new Error("down"));
    services.catalogue.listArtists.mockResolvedValue({ items: [artistSummary()] });

    const urls = (await composeArtSitemap(services, SITE)).map((entry) => entry.url);

    expect(urls).toContain("https://www.thelax.art/");
    expect(urls).toContain("https://www.thelax.art/artists/flora-powers");
    expect(urls.some((url) => url.includes("/artworks/"))).toBe(false);
  });
});
