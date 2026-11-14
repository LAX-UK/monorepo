import { buildListHref } from "@/lib/admin/admin-list-params";
import { parseAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import { listQueryFromRecord, recordHrefInList } from "@auction/staff-ui";

type Search = Record<string, string | string[] | undefined>;

/**
 * A person's page and the people list it was opened from. The clients and staff lists are record
 * lists (staff design standard, TBL-8): a row opens the person's page, which carries the list's
 * query as `?list=`, so its breadcrumb leads back to the list as it was and its record pager steps
 * through the same rows.
 */
export type PeopleListPath = "/admin/clients" | "/admin/staff";

/** Where a person sits in the page of the list they were opened from: "‹ 3 of 50 ›" and J/K. */
export type PeopleRecordPager = {
  position: number;
  total: number;
  previousHref: string | null;
  nextHref: string | null;
  /** The list's query, which the pager keeps on the previous and next person. */
  listQuery: string;
};

/** The panel parameter each list used before rows opened pages; old links still carry it. */
const OLD_PANEL_PARAM: Record<PeopleListPath, string> = {
  "/admin/clients": "client",
  "/admin/staff": "staff",
};

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() || null;

/** The list's own query, as its URL holds it, without the old panel parameter. */
export function peopleListQuery(listPath: PeopleListPath, sp: Search): string {
  const href = buildListHref(listPath, sp, { [OLD_PANEL_PARAM[listPath]]: null, list: null });
  return href.split("?")[1] ?? "";
}

/** A person's page, remembering the list it was opened from. */
export function peopleRecordHref(listPath: PeopleListPath, id: string, listQuery: string): string {
  return recordHrefInList(`${listPath}/${encodeURIComponent(id)}`, listQuery);
}

/**
 * Where an old panel link (`/admin/clients?client=…`, `/admin/staff?staff=…`) now goes: the
 * person's page, keeping the list it was on. Null when the URL opens no panel.
 */
export function peoplePanelRedirect(listPath: PeopleListPath, sp: Search): string | null {
  const id = first(sp[OLD_PANEL_PARAM[listPath]]);
  return id ? peopleRecordHref(listPath, id, peopleListQuery(listPath, sp)) : null;
}

/**
 * The list a person's page leads back to: the list it was opened from (`?list=`), or the staff list
 * of another kind that linked here with `?returnTo=` (onboarding issues, for one), or the whole
 * list.
 */
export function peopleListHrefFromRecord(listPath: PeopleListPath, sp: Search): string {
  const list = listQueryFromRecord(sp);
  if (list) return `${listPath}?${new URLSearchParams(list).toString()}`;
  return parseAdminListReturnTarget(sp.returnTo, listPath);
}
