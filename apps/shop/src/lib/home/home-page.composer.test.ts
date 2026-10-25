import { beforeEach, describe, expect, it, vi } from "vitest";
import { composeHomePageData } from "./home-page.composer.js";

const api = vi.hoisted(() => ({
  fetchPublicArtworks: vi.fn(),
  fetchPublicArtists: vi.fn(),
}));

vi.mock("@/lib/shop-api.server", () => api);

const artist = (slug: string) => ({
  slug,
  name: slug,
  discipline: null,
  portraitUrl: null,
  artworkCount: 2,
});

describe("composeHomePageData", () => {
  beforeEach(() => {
    api.fetchPublicArtworks.mockReset();
    api.fetchPublicArtists.mockReset();
  });

  it("reads editions on sale now, featured artists and every artist for the count", async () => {
    api.fetchPublicArtworks.mockResolvedValue({ items: [] });
    api.fetchPublicArtists.mockResolvedValue({ items: [] });

    await composeHomePageData();

    expect(api.fetchPublicArtworks).toHaveBeenCalledWith({ limit: 9, availability: "available" });
    expect(api.fetchPublicArtists).toHaveBeenCalledWith({
      limit: 4,
      placement: "featured_artists",
    });
    expect(api.fetchPublicArtists).toHaveBeenCalledWith({ limit: 50 });
  });

  it("keeps the artists when the editions read fails", async () => {
    api.fetchPublicArtworks.mockRejectedValueOnce(new Error("catalogue offline"));
    api.fetchPublicArtists.mockImplementation(async (input: { placement?: string }) =>
      input.placement ? { items: [artist("featured")] } : { items: [artist("a"), artist("b")] },
    );

    const result = await composeHomePageData();

    expect(result.editions).toEqual([]);
    expect(result.sectionErrors).toEqual({ editions: "catalogue offline" });
    expect(result.artists.map((a) => a.slug)).toEqual(["featured"]);
    expect(result.artistCount).toBe(2);
  });

  it("falls back to the newest artists when none are featured", async () => {
    api.fetchPublicArtworks.mockResolvedValue({ items: [] });
    api.fetchPublicArtists.mockImplementation(async (input: { placement?: string }) =>
      input.placement
        ? { items: [] }
        : { items: ["a", "b", "c", "d", "e"].map(artist), nextCursor: "next" },
    );

    const result = await composeHomePageData();

    expect(result.artists.map((a) => a.slug)).toEqual(["a", "b", "c", "d"]);
    // More artists than one read returns: no number is claimed.
    expect(result.artistCount).toBeNull();
  });
});
