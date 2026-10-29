import {
  AVAILABILITY_LABELS,
  PRICE_BAND_LABELS,
  SIZE_BAND_LABELS,
} from "@/lib/catalogue/artwork-catalogue-filter-config";
import {
  type ArtworkCatalogueFilterPatch,
  type ArtworkCatalogueUrlState,
  type CatalogActiveFilterChip,
  artworkCatalogueFilterHref,
} from "@/lib/catalogue/artwork-catalogue-params";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";

export type CatalogueChipLookups = {
  categories: ReadonlyArray<{ slug: string; label: string }>;
  artists: ReadonlyArray<{ slug: string; name: string }>;
};

function freeRangeLabel(minPrice: number | undefined, maxPrice: number | undefined): string {
  const pounds = (value: number) => formatGbpPenceForDisplay(value * 100);
  if (minPrice !== undefined && maxPrice !== undefined) {
    return `${pounds(minPrice)} to ${pounds(maxPrice)}`;
  }
  if (minPrice !== undefined) return `From ${pounds(minPrice)}`;
  return `Up to ${pounds(maxPrice ?? 0)}`;
}

/** One chip per applied filter, in the rail's order, each with the link that takes it off. */
export function buildArtworkCatalogueActiveChips(
  state: ArtworkCatalogueUrlState,
  lookups: CatalogueChipLookups,
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  const add = (key: string, label: string, clear: ArtworkCatalogueFilterPatch) => {
    chips.push({ key, label, removeHref: artworkCatalogueFilterHref(state, clear) });
  };
  if (state.q) add("q", `“${state.q}”`, { q: null });
  if (state.availability) {
    add("availability", AVAILABILITY_LABELS[state.availability], { availability: null });
  }
  if (state.artistSlug) {
    const name = lookups.artists.find((a) => a.slug === state.artistSlug)?.name;
    add("artist", name ?? state.artistSlug, { artistSlug: null });
  }
  if (state.price) add("price", PRICE_BAND_LABELS[state.price], { price: null });
  if (state.minPrice !== undefined || state.maxPrice !== undefined) {
    add("price", freeRangeLabel(state.minPrice, state.maxPrice), {
      minPrice: null,
      maxPrice: null,
    });
  }
  if (state.size) add("size", SIZE_BAND_LABELS[state.size], { size: null });
  if (state.technique) add("technique", state.technique, { technique: null });
  if (state.categorySlug) {
    const label = lookups.categories.find((c) => c.slug === state.categorySlug)?.label;
    add("category", label ?? state.categorySlug, { categorySlug: null });
  }
  return chips;
}
