import type { SearchSortValue } from "@/components/marketing/search-sort-select";
import type { SearchEndingWindow } from "@/lib/marketing/parse-search-params";
import type { LotStatus } from "@auction/types";

/** Count non-default search filters for the mobile Filters badge. */
export function countSearchActiveFilters(opts: {
  q?: string;
  categoryId?: string;
  sort: SearchSortValue;
  status?: LotStatus;
  ending?: SearchEndingWindow;
}): number {
  let n = 0;
  if (opts.q?.trim()) n += 1;
  if (opts.categoryId) n += 1;
  if (opts.sort !== "endingAsc") n += 1;
  if (opts.status) n += 1;
  if (opts.ending) n += 1;
  return n;
}
