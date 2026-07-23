import "server-only";

import {
  type LotFulfilmentListSearchParams,
  buildLotFulfilmentListPageModel,
} from "@/lib/admin/build-lot-fulfilment-list-page-model";
import { getAdminLotFulfilmentPage } from "@/lib/data/http/admin-lot-fulfilment.reader";
import { EMPTY_ADMIN_LOT_FULFILMENT_LIST_SUMMARY } from "@/lib/data/http/admin-lot-fulfilment.shared";

export async function loadAdminLotFulfilmentListPage(sp: LotFulfilmentListSearchParams) {
  const model = buildLotFulfilmentListPageModel(sp);

  try {
    const page = await getAdminLotFulfilmentPage(model.listQueryParams);
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
    const message = error instanceof Error ? error.message : "Could not load lot fulfilment.";
    return {
      model,
      rows: [],
      summary: EMPTY_ADMIN_LOT_FULFILMENT_LIST_SUMMARY,
      total: 0,
      hasNextPage: false,
      loadError: message === "forbidden" ? "Access denied" : message,
      pagination: null,
    };
  }
}
