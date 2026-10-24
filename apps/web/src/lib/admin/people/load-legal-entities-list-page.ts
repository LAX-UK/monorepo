import "server-only";

import { legalEntitiesListController } from "@/lib/admin/list-controllers/legal-entities-list-controller";
import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";
import {
  type LegalEntitiesListSearch,
  activeLegalEntitiesView,
  legalEntitiesListHref,
  legalEntitiesRangeSummary,
  toLegalEntitiesStaffRows,
  toLegalEntityPreview,
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
  const selectedEntityId = search.entity?.trim() || null;
  const base = {
    search,
    view: activeLegalEntitiesView(search),
    pageSize: query.limit,
    selectedEntityId,
  };

  try {
    const [page, detail] = await Promise.all([
      legalEntitiesListController.fetchPage(query),
      selectedEntityId
        ? loadAdminLegalEntityDetail(selectedEntityId).catch(() => null)
        : Promise.resolve(null),
    ]);
    const rows = toLegalEntitiesStaffRows(page.rows);
    const { offset, limit } = query;
    return {
      ...base,
      rows,
      summary: page.summary,
      preview: detail ? toLegalEntityPreview(detail) : null,
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
      preview: null,
      loadError:
        error instanceof Error && error.message === "forbidden"
          ? "You do not have access to legal entities."
          : LEGAL_ENTITIES_LOAD_ERROR,
      pagination: null,
    };
  }
}

export type AdminLegalEntitiesListPage = Awaited<ReturnType<typeof loadAdminLegalEntitiesListPage>>;
