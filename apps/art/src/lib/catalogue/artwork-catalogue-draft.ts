import { parsePoundsToPence } from "@auction/ui";
import type {
  ArtworkCatalogueFilterPatch,
  ArtworkCatalogueSort,
  ArtworkCatalogueUrlState,
  ArtworkObjectType,
} from "./artwork-catalogue-params";

/**
 * Unapplied filter drawer choices. The URL stays the source of truth: the drawer edits this copy
 * and only Apply turns it into a navigation. Search (`q`) is not part of it; the header owns search.
 */
export type ArtworkCatalogueDraft = {
  sort: ArtworkCatalogueSort;
  artistSlugs: string[];
  objectTypes: ArtworkObjectType[];
  categorySlug: string;
  saleState: NonNullable<ArtworkCatalogueUrlState["saleState"]> | "";
  /** Whole pounds as typed. */
  minPrice: string;
  maxPrice: string;
};

export const EMPTY_ARTWORK_CATALOGUE_DRAFT: ArtworkCatalogueDraft = {
  sort: "newest",
  artistSlugs: [],
  objectTypes: [],
  categorySlug: "",
  saleState: "",
  minPrice: "",
  maxPrice: "",
};

export function artworkDraftFromState(state: ArtworkCatalogueUrlState): ArtworkCatalogueDraft {
  return {
    sort: state.sort,
    artistSlugs: [...state.artistSlugs],
    objectTypes: [...state.objectTypes],
    categorySlug: state.categorySlug ?? "",
    saleState: state.saleState ?? "",
    minPrice: state.minPrice !== undefined ? String(state.minPrice) : "",
    maxPrice: state.maxPrice !== undefined ? String(state.maxPrice) : "",
  };
}

/** Whole pounds from a price filter box; pence typed after the point are dropped. */
function parsePounds(value: string): number | null {
  const parsed = parsePoundsToPence(value);
  return parsed.ok ? Math.floor(parsed.pence / 100) : null;
}

export function artworkDraftToPatch(draft: ArtworkCatalogueDraft): ArtworkCatalogueFilterPatch {
  return {
    sort: draft.sort,
    artistSlugs: draft.artistSlugs,
    objectTypes: draft.objectTypes,
    categorySlug: draft.categorySlug || null,
    saleState: draft.saleState || null,
    minPrice: parsePounds(draft.minPrice),
    maxPrice: parsePounds(draft.maxPrice),
  };
}
