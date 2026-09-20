import { describe, expect, it, vi } from "vitest";
import { createGetPublicArtistHandler } from "./get-public-artist.handler.js";
import { createListPublicArtistsHandler } from "./list-public-artists.handler.js";
import { createListPublicArtworksHandler } from "./list-public-artworks.handler.js";
import { createListPublicCategoriesHandler } from "./list-public-categories.handler.js";

describe("catalogue handlers", () => {
  it("forwards the complete artwork query to the narrow reader port", async () => {
    const listPublicArtworks = vi.fn(async () => ({ items: [] }));
    const handler = createListPublicArtworksHandler({
      listPublicArtworks,
      getPublicArtworkBySlug: async () => null,
    });
    const input = {
      limit: 12,
      filter: {
        placement: "featured_prints" as const,
        editionEligible: true,
      },
    };

    await handler(input);

    expect(listPublicArtworks).toHaveBeenCalledWith({
      limit: 12,
      filter: {
        placement: "featured_prints",
        editionEligible: true,
        artworkType: "edition",
        sort: "newest",
      },
    });
  });

  it("keeps category and artist capabilities segregated", async () => {
    const listPublicCategories = vi.fn(async () => ({ items: [] }));
    const listPublicArtists = vi.fn(async () => ({ items: [] }));
    const getPublicArtistBySlug = vi.fn(async () => null);

    await createListPublicCategoriesHandler({
      listPublicCategories,
      getPublicCategoryBySlug: async () => null,
    })({ limit: 8, placement: "featured_categories" });
    await createListPublicArtistsHandler({
      listPublicArtists,
      getPublicArtistBySlug,
    })({ limit: 8, placement: "featured_artists" });
    await createGetPublicArtistHandler({
      listPublicArtists,
      getPublicArtistBySlug,
    })("artist");

    expect(listPublicCategories).toHaveBeenCalledWith({
      limit: 8,
      placement: "featured_categories",
      cursor: null,
    });
    expect(listPublicArtists).toHaveBeenCalledOnce();
    expect(getPublicArtistBySlug).toHaveBeenCalledWith("artist");
  });
});
