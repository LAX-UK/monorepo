/** Server-side lot list sort keys (admin catalog). */
export type LotListSortKey = "createdDesc" | "endingAsc" | "hammerDesc" | "endedDesc";

export const LOT_LIST_SORT_KEYS: readonly LotListSortKey[] = [
  "createdDesc",
  "endingAsc",
  "hammerDesc",
  "endedDesc",
];

export function isLotListSortKey(value: string | undefined): value is LotListSortKey {
  return value != null && (LOT_LIST_SORT_KEYS as readonly string[]).includes(value);
}

export const LOT_LIST_SORT_LABELS: Record<LotListSortKey, string> = {
  createdDesc: "Newest first",
  endingAsc: "Ending soonest",
  hammerDesc: "Highest hammer",
  endedDesc: "Ended recently",
};
