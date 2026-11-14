import "server-only";

import { listQueryFromRecord } from "@auction/staff-ui";
import { headers } from "next/headers";
import { type ListRecordPagerModel, listRecordPager } from "./list-record";

/**
 * The list a record page was opened from (`?list=`), read from the request (middleware passes
 * the search to admin pages), so a layout can read it too.
 */
export async function requestListQuery(): Promise<string | null> {
  const requestHeaders = await headers();
  return listQueryFromRecord(requestHeaders.get("x-search") ?? "");
}

/**
 * The record pager for a record opened from a list: loads that list's rows with the same query
 * and finds the record among them. Null when the page was opened on its own, the list cannot be
 * loaded, or the record is not on that page of the list; the page then shows no pager.
 */
export async function loadListRecordPager({
  listQuery,
  currentId,
  recordHref,
  loadIds,
}: {
  listQuery: string | null;
  currentId: string;
  recordHref: (id: string) => string;
  /** The ids of the list's rows for this query, in the order the list shows them. */
  loadIds: (listSearch: Record<string, string>) => Promise<readonly string[]>;
}): Promise<ListRecordPagerModel | null> {
  if (!listQuery) return null;
  const listSearch = Object.fromEntries(new URLSearchParams(listQuery));
  const ids = await loadIds(listSearch).catch(() => null);
  if (!ids) return null;
  return listRecordPager(ids, currentId, recordHref, listQuery);
}
