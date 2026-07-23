import "server-only";

import {
  type InvitationsListSearchParams,
  buildInvitationsListPageModel,
} from "@/lib/admin/people/build-invitations-list-page-model";
import {
  findAdminInvitationInList,
  getAdminInvitationsPage,
} from "@/lib/data/http/invitations.reader";
import { EMPTY_ADMIN_INVITATIONS_LIST_SUMMARY } from "@/lib/data/http/invitations.shared";
import type { AdminInvitationSummary } from "@/lib/data/http/invitations.shared";
import { adminInvitationsKeys } from "@/lib/data/queries/admin-invitations";
import { getQueryClient } from "@/lib/query/get-query-client";
import { dehydrate } from "@tanstack/react-query";

export async function loadAdminInvitationsListPage(sp: InvitationsListSearchParams) {
  const model = buildInvitationsListPageModel(sp);

  try {
    const queryClient = getQueryClient();
    const page = await getAdminInvitationsPage(model.listQueryParams);
    queryClient.setQueryData(adminInvitationsKeys.list(model.listQueryParams), page);

    const selectedId = model.selectedInvitationId;
    const selectedFromPage = selectedId
      ? (page.rows.find((row) => row.id === selectedId) ?? null)
      : null;
    const selectedOffPage =
      selectedId && !selectedFromPage
        ? await findAdminInvitationInList(selectedId, {
            pageSize: model.query.limit,
            knownTotal: page.total,
            ...(model.listQueryParams.status ? { status: model.listQueryParams.status } : {}),
          })
        : null;
    const selectedInvitation: AdminInvitationSummary | null = selectedFromPage ?? selectedOffPage;

    return {
      model,
      rows: page.rows,
      summary: page.summary,
      total: page.total,
      hasNextPage: page.hasNextPage,
      selectedInvitation,
      previewDegraded: Boolean(selectedId && !selectedInvitation),
      dehydratedState: dehydrate(queryClient),
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
    const message = error instanceof Error ? error.message : "Could not load invitations.";
    return {
      model,
      rows: [],
      summary: EMPTY_ADMIN_INVITATIONS_LIST_SUMMARY,
      total: 0,
      hasNextPage: false,
      selectedInvitation: null,
      previewDegraded: false,
      dehydratedState: undefined,
      loadError: message === "forbidden" ? "Access denied" : message,
      pagination: null,
    };
  }
}
