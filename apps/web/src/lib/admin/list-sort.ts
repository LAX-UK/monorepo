import { buildListHref } from "@/lib/admin/admin-list-params";

/** Toggle server sort on a list URL; clears sort when the same column is clicked again. */
export function buildSortHref(
  basePath: string,
  current: Record<string, string | string[] | undefined>,
  sortValue: string,
  activeSort?: string,
): string {
  return buildListHref(basePath, current, {
    sort: activeSort === sortValue ? "" : sortValue,
    offset: 0,
  });
}

export type SortDirection = "asc" | "desc";

/** Visual arrow direction for named server sort keys. */
export function sortDirectionForValue(sortValue: string): SortDirection {
  if (sortValue.endsWith("Asc") || sortValue === "sellerAsc" || sortValue === "startAsc") {
    return "asc";
  }
  return "desc";
}
