import "server-only";

import {
  type SofListSearchParams,
  buildSofListPageModel,
} from "@/lib/admin/compliance/build-sof-list-page-model";
import {
  type SofListSearch,
  type SofStaffRow,
  sofListHref,
  sofRangeSummary,
  toSofStaffRows,
} from "@/lib/admin/compliance/sof-staff-list.vm";
import type { SessionUser } from "@/lib/data/contracts";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminSourceOfFundsPage } from "@/lib/data/http/compliance-sof.reader";
import { EMPTY_ADMIN_SOF_LIST_SUMMARY } from "@/lib/data/http/compliance-sof.shared";
import { MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

/** Shown in place of the rows; the raw failure stays in the server logs. */
const SOF_LOAD_ERROR = "We could not load the source of funds cases. Try again in a moment.";

/** The search params as plain strings, so the client can build view and paging links. */
function plainSearch(sp: SofListSearchParams): SofListSearch {
  return Object.fromEntries(
    Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export async function loadAdminSofListPage(sp: SofListSearchParams, user: SessionUser) {
  const model = buildSofListPageModel(sp);
  const search = plainSearch(sp);
  const { status, offset, limit } = model.query;
  const capabilities = {
    canReopen: userHasAccessTo(user.role as UserRole, user.staffRole ?? null, MLRO_DECISION_ACCESS),
  };
  const navCounts = await getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS);
  const attentionCounts = {
    manualReviewCount: navCounts.manualReviewCount,
    amlScreeningsPending: navCounts.amlScreeningsPending,
  };
  const pendingCount = navCounts.sourceOfFundsPending;

  try {
    const page = await getAdminSourceOfFundsPage(model.listQueryParams);
    const rows = toSofStaffRows(page.rows, status, model.listReturnTarget);
    return {
      search,
      status,
      rows,
      summary: page.summary,
      loadError: null as string | null,
      capabilities,
      attentionCounts,
      pendingCount,
      pageSize: limit,
      pagination:
        rows.length > 0
          ? {
              summary: sofRangeSummary(offset, rows.length, page.total),
              prevHref:
                offset > 0 ? sofListHref(search, { offset: Math.max(0, offset - limit) }) : null,
              nextHref: page.hasNextPage ? sofListHref(search, { offset: offset + limit }) : null,
            }
          : null,
    };
  } catch {
    return {
      search,
      status,
      rows: [] as SofStaffRow[],
      summary: EMPTY_ADMIN_SOF_LIST_SUMMARY,
      loadError: SOF_LOAD_ERROR as string | null,
      capabilities,
      attentionCounts,
      pendingCount,
      pageSize: limit,
      pagination: null,
    };
  }
}

export type AdminSofListPage = Awaited<ReturnType<typeof loadAdminSofListPage>>;
