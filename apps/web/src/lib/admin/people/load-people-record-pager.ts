import "server-only";

import { buildClientsListPageModel } from "@/lib/admin/people/build-clients-list-page-model";
import { buildStaffListPageModel } from "@/lib/admin/people/build-staff-list-page-model";
import type { PeopleListPath, PeopleRecordPager } from "@/lib/admin/people/people-record-href";
import { getAdminUserList } from "@/lib/data/http/admin-users.reader";
import { listQueryFromRecord } from "@auction/staff-ui";

type Search = Record<string, string | string[] | undefined>;

function listParams(listPath: PeopleListPath, list: Search) {
  return listPath === "/admin/clients"
    ? buildClientsListPageModel(list).listQueryParams
    : buildStaffListPageModel(list).listQueryParams;
}

/**
 * The pager for a person's page opened from the clients or staff list (`?list=`): the same page of
 * that list, loaded again, and this person's place in it. Null when the page was opened on its own
 * or the person is no longer in that page of the list.
 */
export async function loadPeopleRecordPager(
  listPath: PeopleListPath,
  id: string,
  sp: Search,
): Promise<PeopleRecordPager | null> {
  const listQuery = listQueryFromRecord(sp);
  if (!listQuery) return null;
  const list: Search = {};
  for (const [key, value] of new URLSearchParams(listQuery)) {
    const seen = list[key];
    list[key] = seen === undefined ? value : [...(Array.isArray(seen) ? seen : [seen]), value];
  }
  const page = await getAdminUserList(listParams(listPath, list)).catch(() => null);
  if (!page) return null;
  // `recordPosition` lives in the kit's client module, so the server works the place out here.
  const ids = page.rows.map((row) => row.id);
  const index = ids.indexOf(id);
  if (index < 0) return null;
  const href = (rowId: string | undefined) =>
    rowId ? `${listPath}/${encodeURIComponent(rowId)}` : null;
  return {
    position: index + 1,
    total: ids.length,
    previousHref: href(ids[index - 1]),
    nextHref: href(ids[index + 1]),
    listQuery,
  };
}
