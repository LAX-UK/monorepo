/** One page of a list read: its rows, and the list's total when the endpoint reports one. */
export type ListPage<T> = { rows: readonly T[]; total?: number | undefined };

/** Every row up to `maxRows`, and whether that is the whole list. */
export type PagedRead<T> = { rows: T[]; complete: boolean };

/**
 * Reads a paged list until it ends, so a list that grows is never cut off at the first page.
 * `maxRows` bounds one request's work; when the list is longer, `complete` is false and the
 * page says so ("Showing the latest 1,000") instead of stopping silently.
 */
export async function readAllPages<T>(
  loadPage: (page: { limit: number; offset: number }) => Promise<ListPage<T>>,
  options: { pageSize: number; maxRows: number },
): Promise<PagedRead<T>> {
  const rows: T[] = [];
  for (let offset = 0; offset < options.maxRows; offset += options.pageSize) {
    const limit = Math.min(options.pageSize, options.maxRows - offset);
    const page = await loadPage({ limit, offset });
    rows.push(...page.rows);
    const ended =
      page.rows.length < limit || (page.total !== undefined && rows.length >= page.total);
    if (ended) return { rows, complete: true };
  }
  return { rows, complete: false };
}
