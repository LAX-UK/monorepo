/** Server-side sale list sort keys (admin catalog). */
export type SaleListSortKey = "createdDesc" | "startAsc";

export const SALE_LIST_SORT_KEYS: readonly SaleListSortKey[] = ["createdDesc", "startAsc"];

export function isSaleListSortKey(value: string | undefined): value is SaleListSortKey {
  return value != null && (SALE_LIST_SORT_KEYS as readonly string[]).includes(value);
}

export const SALE_LIST_SORT_LABELS: Record<SaleListSortKey, string> = {
  createdDesc: "Newest first",
  startAsc: "Starting soonest",
};
