import "server-only";

import { legalEntitiesListController } from "@/lib/admin/list-controllers/legal-entities-list-controller";
import {
  type LegalEntitiesListSearch,
  activeLegalEntitiesView,
  legalEntitiesListHref,
  legalEntitiesRangeSummary,
  legalEntitiesSortState,
  sortLegalEntitiesStaffRows,
  toLegalEntitiesStaffRows,
} from "@/lib/admin/people/legal-entities-staff-list.vm";
import { EMPTY_ADMIN_LEGAL_ENTITIES_LIST_SUMMARY } from "@/lib/data/http/admin-legal-entities.shared";

/** Shown in place of the rows; the raw failure stays in the server logs. */
const LEGAL_ENTITIES_LOAD_ERROR = "We could not load legal entities. Try again in a moment.";

/** The search params as plain strings, so the client can build view and filter links. */
function plainSearch(sp: LegalEntitiesListSearch): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export async function loadAdminLegalEntitiesListPage(sp: LegalEntitiesListSearch) {
  const query = legalEntitiesListController.parseQuery(sp);
  const search = plainSearch(sp);
  const sort = legalEntitiesSortState(search.sort);
  const base = {
    search,
    view: activeLegalEntitiesView(search),
    sort,
    pageSize: query.limit,
  };

  try {
    const page = await legalEntitiesListController.fetchPage(query);
    const rows = sortLegalEntitiesStaffRows(toLegalEntitiesStaffRows(page.rows), sort);
    const { offset, limit } = query;
    return {
      ...base,
      rows,
      summary: page.summary,
      loadError: null as string | null,
      pagination:
        rows.length > 0
          ? {
              summary: legalEntitiesRangeSummary(offset, rows.length, page.total),
              prevHref:
                offset > 0
                  ? legalEntitiesListHref(search, { offset: Math.max(0, offset - limit) })
                  : null,
              nextHref: page.hasNextPage
                ? legalEntitiesListHref(search, { offset: offset + limit })
                : null,
            }
          : null,
    };
  } catch (error) {
    return {
      ...base,
      rows: [],
      summary: EMPTY_ADMIN_LEGAL_ENTITIES_LIST_SUMMARY,
      loadError:
        error instanceof Error && error.message === "forbidden"
          ? "You do not have access to legal entities."
          : LEGAL_ENTITIES_LOAD_ERROR,
      pagination: null,
    };
  }
}

export type AdminLegalEntitiesListPage = Awaited<ReturnType<typeof loadAdminLegalEntitiesListPage>>;

/**
 * The ids of the legal entities the list shows for this query, in its order: what an entity's
 * page opened from the list steps through (Previous and Next). The list's own query and sort.
 */
export async function loadLegalEntitiesListIds(sp: LegalEntitiesListSearch): Promise<string[]> {
  const query = legalEntitiesListController.parseQuery(sp);
  const page = await legalEntitiesListController.fetchPage(query);
  const sort = legalEntitiesSortState(plainSearch(sp).sort);
  return sortLegalEntitiesStaffRows(toLegalEntitiesStaffRows(page.rows), sort).map((row) => row.id);
}
