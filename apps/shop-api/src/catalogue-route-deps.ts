import type { CountArtworkFacetsHandler } from "./application/handlers/count-artwork-facets.handler.js";
import type { createGetPublicArtistHandler } from "./application/handlers/get-public-artist.handler.js";
import type { createGetPublicArtworkHandler } from "./application/handlers/get-public-artwork.handler.js";
import type { createGetPublicCategoryHandler } from "./application/handlers/get-public-category.handler.js";
import type { createListArtworkObjectTypeFacetsHandler } from "./application/handlers/list-artwork-object-type-facets.handler.js";
import type { createListPublicArtistsHandler } from "./application/handlers/list-public-artists.handler.js";
import type { createListPublicArtworksHandler } from "./application/handlers/list-public-artworks.handler.js";
import type { createListPublicCategoriesHandler } from "./application/handlers/list-public-categories.handler.js";

export type CatalogueRoutesDeps = {
  listPublicArtworks: ReturnType<typeof createListPublicArtworksHandler>;
  getPublicArtwork: ReturnType<typeof createGetPublicArtworkHandler>;
  countArtworkFacets: CountArtworkFacetsHandler;
  listArtworkObjectTypeFacets: ReturnType<typeof createListArtworkObjectTypeFacetsHandler>;
  listPublicCategories: ReturnType<typeof createListPublicCategoriesHandler>;
  getPublicCategory: ReturnType<typeof createGetPublicCategoryHandler>;
  listPublicArtists: ReturnType<typeof createListPublicArtistsHandler>;
  getPublicArtist: ReturnType<typeof createGetPublicArtistHandler>;
};
