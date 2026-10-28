import type { HomeCatalogueReader } from "@/lib/home/home-catalogue.port";
import {
  fetchPublicArtistBySlug,
  fetchPublicArtists,
  fetchPublicArtworkFacets,
  fetchPublicArtworks,
} from "@/lib/shop-api.server";

/** The home page's catalogue reads, over the shop-api public catalogue. */
export const shopApiHomeCatalogueReader: HomeCatalogueReader = {
  listEditions: (query) => fetchPublicArtworks(query),
  countFacets: () => fetchPublicArtworkFacets({}),
  listArtists: (query) => fetchPublicArtists(query),
  getArtist: (slug) => fetchPublicArtistBySlug(slug),
};
