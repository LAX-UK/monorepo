import "server-only";

import {
  type ClientsListSearchParams,
  buildClientsListPageModel,
} from "@/lib/admin/people/build-clients-list-page-model";
import { getAdminUserList } from "@/lib/data/http/admin-users.reader";
import { EMPTY_ADMIN_USER_LIST_SUMMARY } from "@/lib/data/http/admin-users.shared";

export async function loadAdminClientsListPage(sp: ClientsListSearchParams) {
  const model = buildClientsListPageModel(sp);

  try {
    const page = await getAdminUserList(model.listQueryParams);
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
    const message = error instanceof Error ? error.message : "Could not load clients.";
    return {
      model,
      rows: [],
      summary: EMPTY_ADMIN_USER_LIST_SUMMARY,
      total: 0,
      hasNextPage: false,
      loadError: message === "forbidden" ? "Access denied" : message,
      pagination: null,
    };
  }
}
