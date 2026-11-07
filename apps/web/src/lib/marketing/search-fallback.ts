import type { LotStatus } from "@auction/types";

/** Past results shown under an empty on-sale search. More are one click away. */
export const SEARCH_FALLBACK_LOT_LIMIT = 6;
/** Artist matches shown beside them. */
export const SEARCH_FALLBACK_ARTIST_LIMIT = 4;
/** Sale matches shown beside them. */
export const SEARCH_FALLBACK_SALE_LIMIT = 3;

type FallbackContext = {
  /** The trimmed query text. */
  q: string;
  status: LotStatus | undefined;
  ending: string | undefined;
  offset: number;
  /** Lots on sale that matched. */
  onSaleCount: number;
  loadFailed: boolean;
};

/**
 * A search that finds nothing on sale looks at past results, so the catalogue is not a dead end
 * between seasons. It only does so for a plain text search: an explicit status or ending window
 * is an answer in itself, and a later page of results is not an empty search.
 */
export function shouldOfferPastResults(ctx: FallbackContext): boolean {
  return (
    ctx.q.length > 0 &&
    ctx.status === undefined &&
    ctx.ending === undefined &&
    ctx.offset === 0 &&
    ctx.onSaleCount === 0 &&
    !ctx.loadFailed
  );
}

/** "3 past results match", counted in words up to nine. */
export function pastResultsSentence(count: number): string {
  if (count <= 0) return "";
  const words = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const lead = count < words.length ? (words[count] as string) : String(count);
  return count === 1 ? `${lead} past result matches.` : `${lead} past results match.`;
}

/** The query a saved "alert for this search" stores: just the text, so it follows new lots on sale. */
export function searchAlertQuery(q: string, categoryId?: string): Record<string, string> {
  return { q, ...(categoryId ? { categoryId } : {}) };
}

function sameQuery(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "") !== (b[key] ?? "")) return false;
  }
  return true;
}

/** Whether the saved searches already hold an alert for this search text and category. */
export function hasSearchAlert(
  saved: readonly { query: Readonly<Record<string, string>> }[],
  q: string,
  categoryId?: string,
): boolean {
  const query = searchAlertQuery(q, categoryId);
  return saved.some((row) => sameQuery(row.query, query));
}

/** What the person's saved searches say about this search: no alert, an alert, or one with email off. */
export type SearchAlertState = "none" | "on" | "email_off";

/** The state of this search's alert, read from the saved searches with the same match as saving. */
export function searchAlertState(
  saved: readonly { query: Readonly<Record<string, string>>; notifyEmail: boolean }[],
  q: string,
  categoryId?: string,
): SearchAlertState {
  const query = searchAlertQuery(q, categoryId);
  const found = saved.find((row) => sameQuery(row.query, query));
  if (!found) return "none";
  return found.notifyEmail ? "on" : "email_off";
}

export function searchAlertLabel(q: string): string {
  return `Search: ${q}`;
}
