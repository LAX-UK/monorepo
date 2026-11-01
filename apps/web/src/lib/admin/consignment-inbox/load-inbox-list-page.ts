import "server-only";

import {
  fetchConsignmentInbox,
  fetchConsignmentInboxSummary,
} from "@/lib/data/http/consignment-inbox.server";
import type { ConsignmentInboxListResponse, ConsignmentInboxSummary } from "@auction/validators";
import {
  type InboxListState,
  type InboxSearchParams,
  inboxApiQuery,
  parseInboxListState,
} from "./inbox-list-state";

export type InboxListPageModel = {
  state: InboxListState;
  list: ConsignmentInboxListResponse | null;
  summary: ConsignmentInboxSummary | null;
  /** Set when the list could not load; the frame stays and offers Try again. */
  loadError: string | null;
};

const EMPTY_FACETS: ConsignmentInboxListResponse["facets"] = {
  specialist: [],
  sale: [],
  organisation: [],
};

export function emptyInboxFacets() {
  return EMPTY_FACETS;
}

/** The inbox list: its rows for the URL's view, search and filters, and the view counts. */
export async function loadAdminInboxListPage(sp: InboxSearchParams): Promise<InboxListPageModel> {
  const state = parseInboxListState(sp);
  const [list, summary] = await Promise.all([
    fetchConsignmentInbox(inboxApiQuery(state)),
    fetchConsignmentInboxSummary(),
  ]);
  return {
    state,
    list: list.ok ? list.data : null,
    summary: summary.ok ? summary.data : null,
    loadError: list.ok
      ? null
      : "Bid admin couldn’t reach the messages service. Nothing was lost; threads and drafts are kept.",
  };
}
