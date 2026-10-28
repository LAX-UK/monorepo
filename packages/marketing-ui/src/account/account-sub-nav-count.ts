/** How a sub-navigation count reads: urgent (outbid) or a plain number of things to do. */
export type AccountSubNavCountTone = "danger" | "neutral";

export type AccountSubNavCount = {
  value: number;
  tone: AccountSubNavCountTone;
  /** Read by screen readers instead of the bare number ("1 outbid"). */
  label: string;
};

/** The number a badge shows, capped so the link never grows. */
export function accountSubNavCountText(value: number): string {
  return value > 9 ? "9+" : String(value);
}

/** Counts only appear when something is due: zero, negative or missing shows nothing. */
export function visibleAccountSubNavCount(
  count: AccountSubNavCount | null | undefined,
): AccountSubNavCount | null {
  return count && Number.isFinite(count.value) && count.value > 0 ? count : null;
}
