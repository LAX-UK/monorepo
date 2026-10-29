import type { CatalogueReader } from "@/lib/catalogue/catalogue-page.port";
import {
  fetchPublicArtists,
  fetchPublicArtworkFacets,
  fetchPublicArtworks,
  fetchPublicCategories,
} from "@/lib/shop-api.server";

/** The catalogue page's reads, over the shop-api public catalogue. */
export const shopApiCatalogueReader: CatalogueReader = {
  listEditions: (query) => fetchPublicArtworks(query),
  countFacets: (query) => fetchPublicArtworkFacets(query),
  searchArtists: (q, limit) => fetchPublicArtists({ q, limit }),
  listCategories: async () =>
    (await fetchPublicCategories({ limit: 50 })).items.map((item) => ({
      slug: item.slug,
      label: item.label,
    })),
};
