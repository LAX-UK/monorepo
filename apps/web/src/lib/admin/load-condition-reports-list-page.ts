import "server-only";

import {
  type ConditionReportsListSearchParams,
  buildConditionReportsListPageModel,
} from "@/lib/admin/build-condition-reports-list-page-model";
import { getAdminConditionReportsPage } from "@/lib/data/http/admin-condition-reports.reader";
import { EMPTY_ADMIN_CONDITION_REPORT_LIST_SUMMARY } from "@/lib/data/http/admin-condition-reports.shared";

export async function loadAdminConditionReportsListPage(sp: ConditionReportsListSearchParams) {
  const model = buildConditionReportsListPageModel(sp);

  try {
    const page = await getAdminConditionReportsPage(model.listQueryParams);
    return {
      model,
      rows: page.rows,
      summary: page.summary,
      total: page.total,
      hasNextPage: page.hasNextPage,
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
    return {
      model,
      rows: [],
      summary: EMPTY_ADMIN_CONDITION_REPORT_LIST_SUMMARY,
      total: 0,
      hasNextPage: false,
      loadError: error instanceof Error ? error.message : "Could not load condition reports.",
      pagination: null,
    };
  }
}
