import "server-only";

import {
  type AmlListSearch,
  amlListHref,
  amlRangeSummary,
  toAmlStaffRows,
} from "@/lib/admin/compliance/aml-staff-list.vm";
import {
  type AmlListSearchParams,
  buildAmlListPageModel,
} from "@/lib/admin/compliance/build-aml-list-page-model";
import type { SessionUser } from "@/lib/data/contracts";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminUsersByIds } from "@/lib/data/http/admin.server";
import {
  getAdminAmlScreeningById,
  getAdminAmlScreeningsPage,
} from "@/lib/data/http/compliance-aml.reader";
import { EMPTY_ADMIN_AML_LIST_SUMMARY } from "@/lib/data/http/compliance-aml.shared";
import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

/** Shown in place of the rows; the raw failure stays in the server logs. */
const AML_LOAD_ERROR = "We could not load the AML screenings. Try again in a moment.";

/** The search params as plain strings, so the client can build links. */
function plainSearch(sp: AmlListSearchParams): AmlListSearch {
  return Object.fromEntries(
    Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export async function loadAdminAmlListPage(sp: AmlListSearchParams, user: SessionUser) {
  const model = buildAmlListPageModel(sp);
  const search = plainSearch(sp);
  const role = user.role as UserRole;
  const staffRole = user.staffRole ?? null;
  const capabilities = {
    canTriage: userHasAccessTo(role, staffRole, AML_REVIEW_ACCESS),
    canDecide: userHasAccessTo(role, staffRole, MLRO_DECISION_ACCESS),
    currentUserId: user.id,
  };
  const navCounts = await getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS);
  const attentionCounts = {
    manualReviewCount: navCounts.manualReviewCount,
    sourceOfFundsPending: navCounts.sourceOfFundsPending,
  };

  try {
    const selectedId = model.selectedScreeningId;
    const [page, selectedRow] = await Promise.all([
      getAdminAmlScreeningsPage(model.listQueryParams),
      selectedId ? getAdminAmlScreeningById(selectedId).catch(() => null) : Promise.resolve(null),
    ]);
    const selectedOnPage = selectedId ? page.rows.some((row) => row.id === selectedId) : false;
    const needed = [...page.rows, ...(selectedRow && !selectedOnPage ? [selectedRow] : [])];
    const users = await getAdminUsersByIds(needed.map((row) => row.userId)).catch(() => []);
    const labels = new Map(users.map((entry) => [entry.id, entry.name || entry.email || null]));
    const rows = toAmlStaffRows(page.rows, labels);
    const selected =
      selectedRow && !selectedOnPage ? (toAmlStaffRows([selectedRow], labels)[0] ?? null) : null;
    const { offset, limit } = model.query;
    return {
      search,
      rows,
      selected,
      selectedId: selectedId ?? null,
      summary: page.summary,
      loadError: null as string | null,
      capabilities,
      attentionCounts,
      pageSize: limit,
      pagination:
        rows.length > 0
          ? {
              summary: amlRangeSummary(offset, rows.length, page.total),
              prevHref:
                offset > 0 ? amlListHref(search, { offset: Math.max(0, offset - limit) }) : null,
              nextHref: page.hasNextPage ? amlListHref(search, { offset: offset + limit }) : null,
            }
          : null,
    };
  } catch {
    return {
      search,
      rows: [] as ReturnType<typeof toAmlStaffRows>,
      selected: null,
      selectedId: null,
      summary: EMPTY_ADMIN_AML_LIST_SUMMARY,
      loadError: AML_LOAD_ERROR as string | null,
      capabilities,
      attentionCounts,
      pageSize: model.query.limit,
      pagination: null,
    };
  }
}

export type AdminAmlListPage = Awaited<ReturnType<typeof loadAdminAmlListPage>>;
