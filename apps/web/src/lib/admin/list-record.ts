/*
 * A record opened from a list remembers that list: its URL carries the list's query (`?list=`),
 * so the record page pages through the same rows (RecordPager) and an old panel link to the list
 * lands on the record instead. Plain functions, safe on the server and in the browser.
 */
import { recordHrefInList } from "@auction/staff-ui";

type Search = Readonly<Record<string, string | readonly string[] | undefined>>;

/** Params that are never part of a list's state: one-off notices and the KPI period. */
const NOT_LIST_STATE = ["error", "success", "period", "list"] as const;

/**
 * The list's own query (view, search, filters, sort, page), without the record-panel param and
 * one-off notices: what a record opened from the list keeps in `?list=`.
 */
export function listQueryOf(search: Search, drop: readonly string[] = []): string {
  const params = new URLSearchParams();
  const skip = new Set<string>([...NOT_LIST_STATE, ...drop]);
  for (const [key, value] of Object.entries(search)) {
    if (skip.has(key) || value === undefined) continue;
    for (const item of typeof value === "string" ? [value] : value) {
      if (item !== "") params.append(key, item);
    }
  }
  return params.toString();
}

/**
 * Where an old panel link (`/admin/lots?lot=ID&status=live`) goes now: the record's page, still
 * in that list. Null when the URL holds no panel param, so the list renders as usual.
 */
export function panelParamRedirect(
  search: Search,
  param: string,
  recordHref: (id: string) => string,
): string | null {
  const raw = search[param];
  const id = (typeof raw === "string" ? raw : raw?.[0])?.trim();
  if (!id) return null;
  return recordHrefInList(recordHref(id), listQueryOf(search, [param]));
}

/** "‹ 3 of 50 ›" on a record page: its place in the list it was opened from. */
export type ListRecordPagerModel = {
  position: number;
  total: number;
  previousHref: string | null;
  nextHref: string | null;
  /** The list's query; the pager keeps it on the previous and next records. */
  listQuery: string;
};

/** The record's place among the list's rows, or null when it is not among them. */
export function listRecordPager(
  ids: readonly string[],
  currentId: string,
  recordHref: (id: string) => string,
  listQuery: string,
): ListRecordPagerModel | null {
  const index = ids.indexOf(currentId);
  if (index < 0) return null;
  const previous = ids[index - 1];
  const next = ids[index + 1];
  return {
    position: index + 1,
    total: ids.length,
    previousHref: previous ? recordHref(previous) : null,
    nextHref: next ? recordHref(next) : null,
    listQuery,
  };
}
