import {
  ARTWORK_FILTER_GROUPS,
  type ArtworkFilterGroupValue,
  MIN_FILTER_GROUP_OPTIONS,
  PRICE_BAND_LABELS,
  SIZE_BAND_LABELS,
} from "@/lib/catalogue/artwork-catalogue-filter-config";
import {
  type ArtworkCatalogueFilterPatch,
  type ArtworkCatalogueUrlState,
  artworkCatalogueFilterHref,
} from "@/lib/catalogue/artwork-catalogue-params";
import type { PublicArtworkFacetCounts } from "@auction/shop-contracts";
import {
  CATALOGUE_PRICE_BAND_KEYS,
  CATALOGUE_SIZE_BAND_KEYS,
  type CataloguePriceBandKey,
  type CatalogueSizeBandKey,
} from "@auction/shop-domain";

/** One option in the rail: choosing it applies it, choosing it again takes it off. */
export type CatalogueFilterOptionVm = {
  value: string;
  label: string;
  /** Editions it would give with the other filters; absent when the counts did not load. */
  count?: number;
  active: boolean;
  href: string;
};

export type CatalogueFilterGroupVm = {
  key: ArtworkFilterGroupValue;
  title: string;
  options: CatalogueFilterOptionVm[];
};

/** The "Available only" switch; null when it would not change the list. */
export type CatalogueAvailabilitySwitchVm = {
  checked: boolean;
  href: string;
} | null;

export type CatalogueFilterRailVm = {
  availability: CatalogueAvailabilitySwitchVm;
  groups: CatalogueFilterGroupVm[];
};

export type CatalogueFilterInputs = {
  state: ArtworkCatalogueUrlState;
  /** Counts with the shopper's filters; null when they did not load. */
  facets: PublicArtworkFacetCounts | null;
  /** Every artist with editions, for the rail when the counts did not load. */
  artists: ReadonlyArray<{ slug: string; name: string }>;
};

type OptionSource = { value: string; label: string; count?: number | undefined };

function option(
  state: ArtworkCatalogueUrlState,
  source: OptionSource,
  active: boolean,
  patch: ArtworkCatalogueFilterPatch,
  clear: ArtworkCatalogueFilterPatch,
): CatalogueFilterOptionVm {
  return {
    value: source.value,
    label: source.label,
    ...(source.count !== undefined ? { count: source.count } : {}),
    active,
    href: artworkCatalogueFilterHref(state, active ? clear : patch),
  };
}

/**
 * Options with no works are left out, unless chosen. A group with fewer than two options left
 * has nothing to choose between and is left out too, unless one of its options is chosen, so a
 * shopper can always take a filter off where they put it on.
 */
function keepUseful(options: CatalogueFilterOptionVm[]): CatalogueFilterOptionVm[] {
  const visible = options.filter((o) => o.active || o.count === undefined || o.count > 0);
  const withWorks = visible.filter((o) => o.count === undefined || o.count > 0).length;
  if (withWorks < MIN_FILTER_GROUP_OPTIONS && !visible.some((o) => o.active)) return [];
  return visible;
}

function countOf(
  rows: ReadonlyArray<{ key: string; count: number }> | undefined,
  key: string,
): number | undefined {
  if (!rows) return undefined;
  return rows.find((row) => row.key === key)?.count ?? 0;
}

function artistOptions({ state, facets, artists }: CatalogueFilterInputs) {
  const sources: OptionSource[] = facets
    ? facets.artists.map((a) => ({ value: a.slug, label: a.name, count: a.count }))
    : artists.map((a) => ({ value: a.slug, label: a.name }));
  if (state.artistSlug && !sources.some((s) => s.value === state.artistSlug)) {
    const known = artists.find((a) => a.slug === state.artistSlug);
    sources.push({ value: state.artistSlug, label: known?.name ?? state.artistSlug, count: 0 });
  }
  return sources.map((s) =>
    option(state, s, s.value === state.artistSlug, { artistSlug: s.value }, { artistSlug: null }),
  );
}

function priceOptions({ state, facets }: CatalogueFilterInputs) {
  return CATALOGUE_PRICE_BAND_KEYS.map((key: CataloguePriceBandKey) =>
    option(
      state,
      { value: key, label: PRICE_BAND_LABELS[key], count: countOf(facets?.priceBands, key) },
      state.price === key,
      { price: key },
      { price: null },
    ),
  );
}

function sizeOptions({ state, facets }: CatalogueFilterInputs) {
  // Sizes come from the counts only: without them nothing says which sizes exist.
  if (!facets?.sizes) return [];
  return CATALOGUE_SIZE_BAND_KEYS.map((key: CatalogueSizeBandKey) =>
    option(
      state,
      { value: key, label: SIZE_BAND_LABELS[key], count: countOf(facets.sizes, key) },
      state.size === key,
      { size: key },
      { size: null },
    ),
  );
}

function techniqueOptions({ state, facets }: CatalogueFilterInputs) {
  const rows = facets?.techniques ?? [];
  const chosen = state.technique?.toLowerCase();
  const sources: OptionSource[] = rows.map((row) => ({
    value: row.value,
    label: row.value,
    count: row.count,
  }));
  if (state.technique && !sources.some((s) => s.value.toLowerCase() === chosen)) {
    sources.push({ value: state.technique, label: state.technique, count: 0 });
  }
  return sources.map((s) =>
    option(state, s, s.value.toLowerCase() === chosen, { technique: s.value }, { technique: null }),
  );
}

const GROUP_OPTIONS: Record<
  ArtworkFilterGroupValue,
  (inputs: CatalogueFilterInputs) => CatalogueFilterOptionVm[]
> = {
  artist: artistOptions,
  price: priceOptions,
  size: sizeOptions,
  technique: techniqueOptions,
};

function availabilitySwitch({
  state,
  facets,
}: CatalogueFilterInputs): CatalogueAvailabilitySwitchVm {
  const checked = state.availability === "available";
  // With nothing sold out (or nothing on sale), hiding sold-out editions changes nothing.
  if (
    !checked &&
    facets &&
    (facets.availability.soldOut === 0 || facets.availability.available === 0)
  ) {
    return null;
  }
  return {
    checked,
    href: artworkCatalogueFilterHref(state, { availability: checked ? null : "available" }),
  };
}

/** The filter rail for the catalogue's current filters and counts. */
export function buildCatalogueFilterRail(inputs: CatalogueFilterInputs): CatalogueFilterRailVm {
  const groups = ARTWORK_FILTER_GROUPS.map((group) => ({
    key: group.value,
    title: group.title,
    options: keepUseful(GROUP_OPTIONS[group.value](inputs)),
  })).filter((group) => group.options.length > 0);
  return { availability: availabilitySwitch(inputs), groups };
}
