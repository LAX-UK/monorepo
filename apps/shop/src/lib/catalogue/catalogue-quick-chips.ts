import {
  AVAILABILITY_LABELS,
  PRICE_BAND_LABELS,
} from "@/lib/catalogue/artwork-catalogue-filter-config";
import {
  type ArtworkCatalogueFilterPatch,
  type ArtworkCatalogueUrlState,
  artworkCatalogueFilterHref,
} from "@/lib/catalogue/artwork-catalogue-params";
import type { PublicArtworkFacetCounts } from "@auction/shop-contracts";
import { CATALOGUE_PRICE_BAND_KEYS } from "@auction/shop-domain";

/** A one-tap filter above the results; tapping an applied chip takes it off. */
export type CatalogueQuickChipVm = {
  key: string;
  label: string;
  count: number;
  active: boolean;
  href: string;
};

/**
 * One row of chips: "Available now", then the two price bands and the two artists with the most
 * editions (an applied chip always stays, on top of these).
 */
export const QUICK_CHIP_PRICE_BANDS = 2;
export const QUICK_CHIP_ARTISTS = 2;

type Candidate = {
  key: string;
  label: string;
  count: number;
  /** Editions across the chip's whole group, with the other filters applied. */
  groupTotal: number;
  active: boolean;
  apply: ArtworkCatalogueFilterPatch;
  clear: ArtworkCatalogueFilterPatch;
};

function sum(counts: ReadonlyArray<{ count: number }>): number {
  return counts.reduce((total, row) => total + row.count, 0);
}

/**
 * A chip earns its place by narrowing the list: it has editions, but not all of the group's. An
 * applied chip always stays, so it can be taken off where it was put on.
 */
function narrows(candidate: Candidate): boolean {
  return candidate.active || (candidate.count > 0 && candidate.count < candidate.groupTotal);
}

function availabilityCandidate(
  state: ArtworkCatalogueUrlState,
  facets: PublicArtworkFacetCounts,
): Candidate {
  const { available, soldOut } = facets.availability;
  return {
    key: "available",
    label: AVAILABILITY_LABELS.available,
    count: available,
    groupTotal: available + soldOut,
    active: state.availability === "available",
    apply: { availability: "available" },
    clear: { availability: null },
  };
}

function priceCandidates(
  state: ArtworkCatalogueUrlState,
  facets: PublicArtworkFacetCounts,
): Candidate[] {
  const bands = facets.priceBands ?? [];
  const groupTotal = sum(bands);
  return CATALOGUE_PRICE_BAND_KEYS.map((key) => ({
    key: `price-${key}`,
    label: PRICE_BAND_LABELS[key],
    count: bands.find((band) => band.key === key)?.count ?? 0,
    groupTotal,
    active: state.price === key,
    apply: { price: key },
    clear: { price: null },
  }));
}

function artistCandidates(
  state: ArtworkCatalogueUrlState,
  facets: PublicArtworkFacetCounts,
): Candidate[] {
  const groupTotal = sum(facets.artists);
  const top = [...facets.artists]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, QUICK_CHIP_ARTISTS);
  const chosen = facets.artists.find((artist) => artist.slug === state.artistSlug);
  if (chosen && !top.includes(chosen)) top.push(chosen);
  return top.map((artist) => ({
    key: `artist-${artist.slug}`,
    label: artist.name,
    count: artist.count,
    groupTotal,
    active: state.artistSlug === artist.slug,
    apply: { artistSlug: artist.slug },
    clear: { artistSlug: null },
  }));
}

/** The `limit` candidates with most editions, plus any applied one, in their own order. */
function largest(candidates: Candidate[], limit: number): Candidate[] {
  const kept = new Set([...candidates].sort((a, b) => b.count - a.count).slice(0, limit));
  return candidates.filter((candidate) => kept.has(candidate) || candidate.active);
}

/** "Available now", the price bands, then the top artists: each only when it narrows the list. */
export function buildCatalogueQuickChips(
  state: ArtworkCatalogueUrlState,
  facets: PublicArtworkFacetCounts | null,
): CatalogueQuickChipVm[] {
  if (!facets) return [];
  return [
    availabilityCandidate(state, facets),
    ...largest(priceCandidates(state, facets).filter(narrows), QUICK_CHIP_PRICE_BANDS),
    ...artistCandidates(state, facets),
  ]
    .filter(narrows)
    .map((candidate) => ({
      key: candidate.key,
      label: candidate.label,
      count: candidate.count,
      active: candidate.active,
      href: artworkCatalogueFilterHref(state, candidate.active ? candidate.clear : candidate.apply),
    }));
}
