/** A sortable column's server sort keys, one per direction. */
export type ListSortColumns = Record<string, { asc: string; desc: string }>;

export type ListSortState = { columnId: string; direction: "asc" | "desc" };

/**
 * Maps a list's sortable columns to the sort key its API takes (`?sort=created_desc`) and back.
 * The list always shows a sort: an absent or unknown key reads as the default, and choosing the
 * default leaves the URL clean (`param` returns null).
 */
export function defineListSort(columns: ListSortColumns, defaultKey: string) {
  const byKey = new Map<string, ListSortState>();
  for (const [columnId, keys] of Object.entries(columns)) {
    byKey.set(keys.asc, { columnId, direction: "asc" });
    byKey.set(keys.desc, { columnId, direction: "desc" });
  }
  const defaultState = byKey.get(defaultKey);
  if (!defaultState) throw new Error(`Unknown default sort ${defaultKey}`);

  return {
    defaultSort: defaultState,
    state(key: string | null | undefined): ListSortState {
      return (key ? byKey.get(key) : undefined) ?? defaultState;
    },
    /** The `sort` URL value for a header click; null for the default. */
    param(sort: ListSortState | null): string | null {
      if (!sort) return null;
      const keys = columns[sort.columnId];
      if (!keys) return null;
      const key = keys[sort.direction];
      return key === defaultKey ? null : key;
    },
  };
}
