import type { SearchSortValue } from "@/components/marketing/search-sort-select";

/** Count non-default search filters for the mobile Filters badge. */
export function countSearchActiveFilters(opts: {
  q?: string;
  categoryId?: string;
  sort: SearchSortValue;
}): number {
  let n = 0;
  if (opts.q?.trim()) n += 1;
  if (opts.categoryId) n += 1;
  if (opts.sort !== "endingAsc") n += 1;
  return n;
}
