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
    api.fetchPublicArtworks
      .mockRejectedValueOnce(new Error("originals offline"))
      .mockResolvedValueOnce({ items: [{ slug: "print" }] });
    api.fetchPublicCategories.mockResolvedValue({ items: [{ slug: "art" }] });
    api.fetchPublicArtists.mockResolvedValue({ items: [{ slug: "artist" }] });

    const result = await composeHomePageData();

    expect(result.originals).toEqual([]);
    expect(result.prints).toEqual([{ slug: "print" }]);
    expect(result.categories).toEqual([{ slug: "art" }]);
    expect(result.artists).toEqual([{ slug: "artist" }]);
    expect(result.sectionErrors).toEqual({ originals: "originals offline" });
  });

  it("requests each merchandising slot independently", async () => {
    api.fetchPublicArtworks.mockResolvedValue({ items: [] });
    api.fetchPublicCategories.mockResolvedValue({ items: [] });
    api.fetchPublicArtists.mockResolvedValue({ items: [] });

    await composeHomePageData();

    expect(api.fetchPublicArtworks).toHaveBeenNthCalledWith(1, {
      limit: 12,
      placement: "featured_originals",
    });
    expect(api.fetchPublicArtworks).toHaveBeenNthCalledWith(2, {
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
