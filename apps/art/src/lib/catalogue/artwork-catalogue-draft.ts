import type {
  ArtworkCatalogueFilterPatch,
  ArtworkCatalogueSort,
  ArtworkCatalogueType,
  ArtworkCatalogueUrlState,
  ArtworkObjectType,
  ArtworkRarity,
} from "./artwork-catalogue-params";

/**
 * Unapplied filter drawer choices. The URL stays the source of truth: the drawer edits this copy
 * and only Apply turns it into a navigation. Search (`q`) is not part of it; the header owns search.
 */
export type ArtworkCatalogueDraft = {
  type: ArtworkCatalogueType;
  sort: ArtworkCatalogueSort;
  artistSlugs: string[];
  objectTypes: ArtworkObjectType[];
  rarities: ArtworkRarity[];
  categorySlug: string;
  saleState: NonNullable<ArtworkCatalogueUrlState["saleState"]> | "";
  /** Whole pounds as typed. */
  minPrice: string;
  maxPrice: string;
};

export const EMPTY_ARTWORK_CATALOGUE_DRAFT: ArtworkCatalogueDraft = {
  type: "all",
  sort: "newest",
  artistSlugs: [],
  objectTypes: [],
  rarities: [],
  categorySlug: "",
  saleState: "",
  minPrice: "",
  maxPrice: "",
};

export function artworkDraftFromState(state: ArtworkCatalogueUrlState): ArtworkCatalogueDraft {
  return {
    type: state.type,
    sort: state.sort,
    artistSlugs: [...state.artistSlugs],
    objectTypes: [...state.objectTypes],
    rarities: [...state.rarities],
    categorySlug: state.categorySlug ?? "",
    saleState: state.saleState ?? "",
    minPrice: state.minPrice !== undefined ? String(state.minPrice) : "",
    maxPrice: state.maxPrice !== undefined ? String(state.maxPrice) : "",
  };
}

function parsePounds(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function artworkDraftToPatch(draft: ArtworkCatalogueDraft): ArtworkCatalogueFilterPatch {
  return {
    type: draft.type,
    sort: draft.sort,
    artistSlugs: draft.artistSlugs,
    objectTypes: draft.objectTypes,
    rarities: draft.rarities,
    categorySlug: draft.categorySlug || null,
    saleState: draft.saleState || null,
    minPrice: parsePounds(draft.minPrice),
    maxPrice: parsePounds(draft.maxPrice),
  };
}
