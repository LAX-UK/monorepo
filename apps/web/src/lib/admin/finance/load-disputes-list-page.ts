import "server-only";

import {
  type DisputesListSearch,
  activeDisputesView,
  disputesListHref,
  disputesRangeSummary,
  disputesViewTotal,
  toDisputesStaffRows,
} from "@/lib/admin/finance/disputes-staff-list.vm";
import { disputesListController } from "@/lib/admin/list-controllers/disputes-list-controller";
import type { AdminDisputeCaseSummary } from "@auction/types";

const EMPTY_SUMMARY: AdminDisputeCaseSummary = {
  open: 0,
  underReview: 0,
  won: 0,
  lost: 0,
  closed: 0,
};

/** Shown in place of the rows; the raw HTTP failure stays in the server logs. */
const DISPUTES_LOAD_ERROR = "We could not reach the disputes service. Try again in a moment.";

/** The search params as plain strings, so the client can build view links. */
function plainSearch(sp: DisputesListSearch): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export async function loadAdminDisputesListPage(sp: DisputesListSearch) {
  const query = disputesListController.parseQuery(sp);
  const search = plainSearch(sp);
  const view = activeDisputesView(search);
  const base = { search, view, pageSize: query.limit };

  try {
    const page = await disputesListController.fetch(query);
    const rows = toDisputesStaffRows(page.rows);
    const summary = page.summary ?? EMPTY_SUMMARY;
    const { offset, limit } = query;
    const total = Math.max(disputesViewTotal(view, summary), offset + rows.length);
    return {
      ...base,
      rows,
      summary,
      loadError: null as string | null,
      pagination:
        rows.length > 0
          ? {
              summary: disputesRangeSummary(offset, rows.length, total),
              prevHref:
                offset > 0
                  ? disputesListHref(search, { offset: Math.max(0, offset - limit) })
                  : null,
              nextHref: page.hasNextPage
                ? disputesListHref(search, { offset: offset + limit })
                : null,
            }
          : null,
    };
  } catch {
    return {
      ...base,
      rows: [],
      summary: EMPTY_SUMMARY,
      loadError: DISPUTES_LOAD_ERROR as string | null,
      pagination: null,
    };
  }
}

export type AdminDisputesListPage = Awaited<ReturnType<typeof loadAdminDisputesListPage>>;
