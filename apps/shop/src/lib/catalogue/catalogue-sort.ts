import { ARTWORK_SORT_OPTIONS } from "@/lib/catalogue/artwork-catalogue-filter-config";
import {
  type ArtworkCatalogueSort,
  type ArtworkCatalogueUrlState,
  artworkCatalogueFilterHref,
} from "@/lib/catalogue/artwork-catalogue-params";

export type CatalogueSortOptionVm = { value: ArtworkCatalogueSort; label: string; href: string };

export type CatalogueSortVm = {
  current: CatalogueSortOptionVm;
  options: CatalogueSortOptionVm[];
};

/**
 * The sort choices, each as the link that applies it. Whatever the sort, editions that can be
 * bought now come first and sold-out ones last.
 */
export function buildCatalogueSort(state: ArtworkCatalogueUrlState): CatalogueSortVm {
  const options = ARTWORK_SORT_OPTIONS.map((option) => ({
    ...option,
    href: artworkCatalogueFilterHref(state, { sort: option.value }),
  }));
  const current = options.find((option) => option.value === state.sort) ?? options[0];
  if (!current) throw new Error("The catalogue needs at least one sort");
  return { current, options };
}
