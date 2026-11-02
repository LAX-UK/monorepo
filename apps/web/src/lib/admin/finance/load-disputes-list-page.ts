import "server-only";

import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import {
  type DisputesListSearch,
  activeDisputesView,
  disputesListHref,
  disputesRangeSummary,
  toDisputesStaffRows,
} from "@/lib/admin/finance/disputes-staff-list.vm";
import { getDisputeDeskPage } from "@/lib/data/http/dispute-desk.server";
import { parseStaffPageSize } from "@auction/staff-ui";
import type { DisputeDeskCounts } from "@auction/types";

const EMPTY_COUNTS: DisputeDeskCounts = {
  needs_allocation: 0,
  open: 0,
  under_review: 0,
  closed: 0,
  all: 0,
};

/** Shown in place of the rows; the raw HTTP failure stays in the server logs. */
const DISPUTES_LOAD_ERROR = "We could not reach the disputes service. Try again in a moment.";

/** The search params as plain strings, so the client can build view links. */
function plainSearch(sp: DisputesListSearch): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export async function loadAdminDisputesListPage(sp: DisputesListSearch, now = new Date()) {
  const base = parseListSearchParams(sp);
  const limit = parseStaffPageSize(firstString(sp.limit));
  const search = plainSearch(sp);
  const view = activeDisputesView(search);
  const reason = firstString(sp.reason);
  const shared = { search, view, pageSize: limit, filtered: Boolean(base.q || reason) };

  try {
    const page = await getDisputeDeskPage({
      view,
      q: base.q,
      reason,
      limit,
      offset: base.offset,
    });
    const rows = toDisputesStaffRows(page.rows, now);
    const total = Math.max(page.counts[view], base.offset + rows.length);
    return {
      ...shared,
      rows,
      counts: page.counts,
      loadError: null as string | null,
      pagination:
        rows.length > 0
          ? {
              summary: disputesRangeSummary(base.offset, rows.length, total),
              prevHref:
                base.offset > 0
                  ? disputesListHref(search, { offset: Math.max(0, base.offset - limit) })
                  : null,
              nextHref: page.hasNextPage
                ? disputesListHref(search, { offset: base.offset + limit })
                : null,
            }
          : null,
    };
  } catch {
    return {
      ...shared,
      rows: [],
      counts: EMPTY_COUNTS,
      loadError: DISPUTES_LOAD_ERROR as string | null,
      pagination: null,
    };
  }
}

export type AdminDisputesListPage = Awaited<ReturnType<typeof loadAdminDisputesListPage>>;
