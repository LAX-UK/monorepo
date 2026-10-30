import type { SearchRow } from "./account-search";

/** How many recent picks the palette offers before anything is typed. */
export const RECENT_SEARCH_LIMIT = 5;

/** Where the palette keeps what was opened from it, per account, on this device only. */
export type RecentSearchStore = {
  read(accountId: string): SearchRow[];
  remember(accountId: string, row: SearchRow): void;
};

const keyFor = (accountId: string) => `lax.bid.workspace.recent-search.${accountId}`;

const isRow = (value: unknown): value is SearchRow =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof (value as SearchRow).id === "string" &&
  typeof (value as SearchRow).label === "string" &&
  typeof (value as SearchRow).href === "string" &&
  (value as SearchRow).href.startsWith("/");

/** The newest first, without duplicates, at most `RECENT_SEARCH_LIMIT`. */
export function withRecent(rows: readonly SearchRow[], row: SearchRow): SearchRow[] {
  return [row, ...rows.filter((existing) => existing.id !== row.id)].slice(0, RECENT_SEARCH_LIMIT);
}

/**
 * Browser storage, wrapped so a private window or blocked storage only means no recents. Each
 * account has its own list, so one organisation's records never show while acting for another.
 */
export function localRecentSearchStore(storage: () => Storage | null): RecentSearchStore {
  return {
    read(accountId) {
      try {
        const raw = storage()?.getItem(keyFor(accountId));
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter(isRow).slice(0, RECENT_SEARCH_LIMIT) : [];
      } catch {
        return [];
      }
    },
    remember(accountId, row) {
      try {
        const store = storage();
        if (!store) return;
        store.setItem(keyFor(accountId), JSON.stringify(withRecent(this.read(accountId), row)));
      } catch {
        // Storage full or blocked: recents are a convenience, so the pick still opens.
      }
    },
  };
}
