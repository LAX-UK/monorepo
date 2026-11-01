import "server-only";

import {
  fetchConsignmentInbox,
  fetchConsignmentThread,
} from "@/lib/data/http/consignment-inbox.server";
import type { ConsignmentThreadDetail } from "@auction/validators";
import {
  INBOX_VIEW_LABELS,
  type InboxListState,
  type InboxSearchParams,
  inboxApiQuery,
  inboxHref,
  inboxThreadHref,
  parseInboxListState,
} from "./inbox-list-state";

/** Where the thread sits in the list it was opened from: "‹ 1 of 12 ›" and J/K. */
export type InboxThreadPager = {
  position: number;
  total: number;
  previousHref: string | null;
  nextHref: string | null;
};

export type InboxThreadPageModel =
  | {
      kind: "ready";
      detail: ConsignmentThreadDetail;
      /** The list it came from, for the breadcrumb ("Inbox › Unanswered"). */
      list: { label: string; href: string } | null;
      pager: InboxThreadPager | null;
    }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

function hasListContext(sp: InboxSearchParams): boolean {
  return typeof sp.view === "string";
}

async function pagerFor(
  submissionId: string,
  state: InboxListState,
): Promise<InboxThreadPager | null> {
  const page = await fetchConsignmentInbox(inboxApiQuery(state));
  if (!page.ok) return null;
  const ids = page.data.data.map((row) => row.submissionId);
  const index = ids.indexOf(submissionId);
  if (index < 0) return null;
  const href = (id: string | undefined) => (id ? inboxThreadHref(id, state) : null);
  return {
    position: state.offset + index + 1,
    total: page.data.total,
    previousHref: href(ids[index - 1]),
    nextHref: href(ids[index + 1]),
  };
}

/** A thread with its facts, and its place in the list it was opened from. */
export async function loadAdminInboxThreadPage(
  submissionId: string,
  sp: InboxSearchParams,
): Promise<InboxThreadPageModel> {
  const state = hasListContext(sp) ? parseInboxListState(sp) : null;
  const [detail, pager] = await Promise.all([
    fetchConsignmentThread(submissionId),
    state ? pagerFor(submissionId, state) : Promise.resolve(null),
  ]);
  if (!detail.ok) {
    return detail.reason === "not_found"
      ? { kind: "not_found" }
      : detail.reason === "forbidden"
        ? { kind: "forbidden" }
        : { kind: "unavailable" };
  }
  return {
    kind: "ready",
    detail: detail.data,
    list: state ? { label: INBOX_VIEW_LABELS[state.view], href: inboxHref(state) } : null,
    pager,
  };
}
