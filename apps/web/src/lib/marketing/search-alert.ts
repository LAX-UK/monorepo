import {
  type SavedSearchRow,
  createSavedSearch,
  fetchSavedSearches,
} from "@/lib/data/http/saved-searches.client";
import { searchAlertLabel, searchAlertQuery } from "@/lib/marketing/search-fallback";

export type SearchAlertOutcome = "created" | "existing" | "failed";

export type SearchAlertPorts = {
  list: () => Promise<{ ok: true; rows: SavedSearchRow[] } | { ok: false }>;
  create: (input: {
    label: string;
    query: Record<string, string>;
    notifyEmail: boolean;
  }) => Promise<{ ok: boolean }>;
};

const httpPorts: SearchAlertPorts = { list: fetchSavedSearches, create: createSavedSearch };

function sameQuery(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "") !== (b[key] ?? "")) return false;
  }
  return true;
}

/**
 * Saves an alert for a search once. When the visitor already has one for the same text, nothing
 * is written, so coming back from sign-in twice or reloading never stacks duplicates.
 */
export async function ensureSearchAlert(
  q: string,
  categoryId: string | undefined,
  ports: SearchAlertPorts = httpPorts,
): Promise<SearchAlertOutcome> {
  const query = searchAlertQuery(q, categoryId);
  const existing = await ports.list();
  if (existing.ok && existing.rows.some((row) => sameQuery(row.query, query))) return "existing";
  const created = await ports.create({ label: searchAlertLabel(q), query, notifyEmail: true });
  return created.ok ? "created" : "failed";
}
