import type { LotStatus } from "@auction/types";

/** Past results shown under an empty on-sale search. More are one click away. */
export const SEARCH_FALLBACK_LOT_LIMIT = 6;
/** Artist matches shown beside them. */
export const SEARCH_FALLBACK_ARTIST_LIMIT = 4;

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

export function searchAlertLabel(q: string): string {
  return `Search: ${q}`;
}
