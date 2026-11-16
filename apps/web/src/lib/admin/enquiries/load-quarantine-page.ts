import "server-only";

import {
  getEnquiryQuarantine,
  getQuarantinedMessage,
} from "@/lib/data/http/admin-enquiries.reader";
import type { QuarantineListPage, QuarantineMessage } from "@/lib/data/http/admin-enquiries.schema";
import { QUARANTINE_COPY } from "./enquiry-email-copy";
import { type QuarantineView, quarantineListHref, quarantineViewOf } from "./quarantine.vm";

type Search = Record<string, string | string[] | undefined>;

export type QuarantineListModel = {
  view: QuarantineView;
  page: QuarantineListPage | null;
  nextHref: string | null;
  firstHref: string | null;
  loadError: string | null;
};

/** One page of held email for a view; the page shows the error rather than failing. */
export async function loadQuarantineListPage(search: Search): Promise<QuarantineListModel> {
  const view = quarantineViewOf(search.view);
  const cursor = typeof search.cursor === "string" ? search.cursor : null;
  const query = new URLSearchParams({ view, limit: "25" });
  if (cursor) query.set("cursor", cursor);
  try {
    const page = await getEnquiryQuarantine(query);
    return {
      view,
      page,
      nextHref: page.nextCursor ? quarantineListHref(view, page.nextCursor) : null,
      firstHref: cursor ? quarantineListHref(view) : null,
      loadError: null,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") throw error;
    return {
      view,
      page: null,
      nextHref: null,
      firstHref: null,
      loadError: QUARANTINE_COPY.errors.unavailable,
    };
  }
}

export type QuarantineMessageModel =
  | { kind: "ready"; message: QuarantineMessage }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/** One held email; the kind says why there is none to show. */
export async function loadQuarantineMessagePage(id: string): Promise<QuarantineMessageModel> {
  try {
    const message = await getQuarantinedMessage(id);
    return message ? { kind: "ready", message } : { kind: "not_found" };
  } catch (error) {
    return {
      kind: error instanceof Error && error.message === "forbidden" ? "forbidden" : "unavailable",
    };
  }
}
