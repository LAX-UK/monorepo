import "server-only";

import {
  type DisputesListSearchParams,
  buildDisputesListPageModel,
} from "@/lib/admin/build-disputes-list-page-model";
import { getAdminDisputesPage } from "@/lib/data/http/disputes.server";
import { adminDisputesKeys } from "@/lib/data/queries/admin-disputes";
import { getQueryClient } from "@/lib/query/get-query-client";
import type { AdminDisputeCaseSummary } from "@auction/types";
import { dehydrate } from "@tanstack/react-query";

const EMPTY_SUMMARY: AdminDisputeCaseSummary = {
  open: 0,
  underReview: 0,
  won: 0,
  lost: 0,
  closed: 0,
};

export async function loadAdminDisputesListPage(sp: DisputesListSearchParams) {
  const model = buildDisputesListPageModel(sp);
  try {
    const queryClient = getQueryClient();
    const result = await getAdminDisputesPage(model.listQueryParams);
    queryClient.setQueryData(adminDisputesKeys.list(model.listQueryParams), result);
    return {
      model,
      rows: result.rows,
      hasNextPage: result.hasNextPage,
      summary: result.summary,
      dehydratedState: dehydrate(queryClient),
      loadError: null as string | null,
      pagination:
        model.query.offset > 0 || result.hasNextPage
          ? {
              offset: model.query.offset,
              limit: model.query.limit,
              countOnPage: result.rows.length,
              prevHref:
                model.query.offset > 0
                  ? model.buildPaginationHref({
                      offset: Math.max(0, model.query.offset - model.query.limit),
                    })
                  : null,
              nextHref: result.hasNextPage
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
      hasNextPage: false,
      summary: EMPTY_SUMMARY,
      dehydratedState: undefined,
      loadError: error instanceof Error ? error.message : "Could not load dispute cases.",
      pagination: null,
    };
  }
}
