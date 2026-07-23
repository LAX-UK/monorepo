import "server-only";

import { loadAdminLegalEntityDetail } from "@/lib/admin/load-admin-legal-entity-detail";
import {
  type LegalEntitiesListSearchParams,
  buildLegalEntitiesListPageModel,
} from "@/lib/admin/people/build-legal-entities-list-page-model";
import { getAdminLegalEntitiesPage } from "@/lib/data/http/admin-legal-entities.reader";
import { EMPTY_ADMIN_LEGAL_ENTITIES_LIST_SUMMARY } from "@/lib/data/http/admin-legal-entities.shared";

export async function loadAdminLegalEntitiesListPage(sp: LegalEntitiesListSearchParams) {
  const model = buildLegalEntitiesListPageModel(sp);

  try {
    const [page, preview] = await Promise.all([
      getAdminLegalEntitiesPage(model.listQueryParams),
      model.selectedEntityId
        ? loadAdminLegalEntityDetail(model.selectedEntityId).catch(() => null)
        : Promise.resolve(null),
    ]);

    return {
      model,
      rows: page.rows,
      summary: page.summary,
      total: page.total,
      hasNextPage: page.hasNextPage,
      preview,
      loadError: null as string | null,
      pagination:
        page.total > 0 && (model.query.offset > 0 || page.hasNextPage)
          ? {
              offset: model.query.offset,
              limit: model.query.limit,
              countOnPage: page.rows.length,
              total: page.total,
              prevHref:
                model.query.offset > 0
                  ? model.buildPaginationHref({
                      offset: Math.max(0, model.query.offset - model.query.limit),
                    })
                  : null,
              nextHref: page.hasNextPage
                ? model.buildPaginationHref({
                    offset: model.query.offset + model.query.limit,
                  })
                : null,
            }
          : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load legal entities.";
    return {
      model,
      rows: [],
      summary: EMPTY_ADMIN_LEGAL_ENTITIES_LIST_SUMMARY,
      total: 0,
      hasNextPage: false,
      preview: null,
      loadError: message === "forbidden" ? "Access denied" : message,
      pagination: null,
    };
  }
}
