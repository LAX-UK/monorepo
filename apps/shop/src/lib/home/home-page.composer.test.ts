import { beforeEach, describe, expect, it, vi } from "vitest";
import { composeHomePageData } from "./home-page.composer.js";

const api = vi.hoisted(() => ({
  fetchPublicArtworks: vi.fn(),
  fetchPublicCategories: vi.fn(),
  fetchPublicArtists: vi.fn(),
}));

vi.mock("@/lib/shop-api.server", () => api);

describe("composeHomePageData", () => {
  beforeEach(() => {
    api.fetchPublicArtworks.mockReset();
    api.fetchPublicCategories.mockReset();
    api.fetchPublicArtists.mockReset();
  });

  it("preserves healthy sections when one upstream read fails", async () => {
    api.fetchPublicArtworks.mockRejectedValueOnce(new Error("prints offline"));
    api.fetchPublicCategories.mockResolvedValue({ items: [{ slug: "art" }] });
    api.fetchPublicArtists.mockResolvedValue({ items: [{ slug: "artist" }] });

    const result = await composeHomePageData();

    expect(result.prints).toEqual([]);
    expect(result.categories).toEqual([{ slug: "art" }]);
    expect(result.artists).toEqual([{ slug: "artist" }]);
    expect(result.sectionErrors).toEqual({ prints: "prints offline" });
  });

  it("requests each merchandising slot independently", async () => {
    api.fetchPublicArtworks.mockResolvedValue({ items: [] });
    api.fetchPublicCategories.mockResolvedValue({ items: [] });
    api.fetchPublicArtists.mockResolvedValue({ items: [] });

    await composeHomePageData();

    expect(api.fetchPublicArtworks).toHaveBeenCalledTimes(1);
    expect(api.fetchPublicArtworks).toHaveBeenCalledWith({
      limit: 12,
      placement: "featured_prints",
    });
    expect(api.fetchPublicCategories).toHaveBeenCalledWith({
      placement: "featured_categories",
    });
    expect(api.fetchPublicArtists).toHaveBeenCalledWith({
      limit: 12,
      placement: "featured_artists",
    });
  });
});
