import type { PublicArtworkFacetCounts } from "@auction/shop-contracts";

/** Works per option key; a key the read left out has no works. */
export type ArtworkFacetCountMap = Readonly<Record<string, number>>;

/** Works behind each filter option on lax.art, with the other filters applied. */
export type ArtworkFacetCountsVm = {
  artists: ArtworkFacetCountMap;
  categories: ArtworkFacetCountMap;
  /** Absent when shop-api is older than the counts. */
  objectTypes: ArtworkFacetCountMap | null;
  saleStates: ArtworkFacetCountMap | null;
};

function byKey<T>(
  rows: readonly T[],
  key: (row: T) => string,
  count: (row: T) => number,
): ArtworkFacetCountMap {
  return Object.fromEntries(rows.map((row) => [key(row), count(row)]));
}

export function buildArtworkFacetCountsVm(facets: PublicArtworkFacetCounts): ArtworkFacetCountsVm {
  const bands = (rows: PublicArtworkFacetCounts["objectTypes"]) =>
    rows
      ? byKey(
          rows,
          (row) => row.key,
          (row) => row.count,
        )
      : null;
  return {
    artists: byKey(
      facets.artists,
      (row) => row.slug,
      (row) => row.count,
    ),
    categories: byKey(
      facets.categories,
      (row) => row.slug,
      (row) => row.count,
    ),
    objectTypes: bands(facets.objectTypes),
    saleStates: bands(facets.saleStates),
  };
}

/**
 * The options with their counts. With no counts (the read failed) the options stay as they are,
 * so a failed count never removes a choice. An option the counts leave out has no works.
 */
export function withFacetCounts<T extends { value: string }>(
  options: readonly T[],
  counts: ArtworkFacetCountMap | null | undefined,
  /** Values that are not a choice of their own, such as "Any", and so carry no count. */
  uncounted: readonly string[] = [""],
): Array<T & { count?: number }> {
  return options.map((option) =>
    counts && !uncounted.includes(option.value)
      ? { ...option, count: counts[option.value] ?? 0 }
      : { ...option },
  );
}
