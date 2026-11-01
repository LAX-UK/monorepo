/**
 * Outcome of a read that can fail. A failed load is not an empty result:
 * callers show an error state for it, and an empty state only for `ok` with no rows.
 */
export type LoadResult<T> = { ok: true; value: T } | { ok: false };

export const loaded = <T>(value: T): LoadResult<T> => ({ ok: true, value });

export const loadFailed = <T = never>(): LoadResult<T> => ({ ok: false });

/**
 * Run `read`, turning a thrown error into a failed result. The error is logged
 * server-side with `context` and never reaches the visitor.
 */
export async function settle<T>(context: string, read: () => Promise<T>): Promise<LoadResult<T>> {
  try {
    return loaded(await read());
  } catch (error) {
    console.error(`[${context}] load failed`, error);
    return loadFailed();
  }
}
