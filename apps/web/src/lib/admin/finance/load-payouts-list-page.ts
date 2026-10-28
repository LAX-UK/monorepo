import "server-only";

import {
  type PayoutsListSearch,
  activePayoutsView,
  payoutsListHref,
  payoutsRangeSummary,
  toPayoutsStaffRows,
} from "@/lib/admin/finance/payouts-staff-list.vm";
import { payoutsListController } from "@/lib/admin/list-controllers/payouts-list-controller";
import { getAdminLegalEntityById } from "@/lib/data/http/admin-legal-entities.reader";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { EMPTY_ADMIN_PAYOUT_LIST_SUMMARY } from "@/lib/data/http/admin-payouts.shared";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { PAYOUT_PROCESS_ACCESS, PAYOUT_REVERSE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

/** Shown in place of the rows; the raw HTTP failure stays in the server logs. */
const PAYOUTS_LOAD_ERROR = "We could not reach the payouts service. Try again in a moment.";

/** The search params as plain strings, so the client can build view and filter links. */
function plainSearch(sp: PayoutsListSearch): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

/** The filtered seller's name, for its chip, when no row on the page carries it. */
async function sellerFilterName(
  legalEntityId: string | undefined,
  rows: readonly { legalEntityId: string; legalEntityName?: string | null }[],
): Promise<string | null> {
  if (!legalEntityId) return null;
  const onPage = rows.find((row) => row.legalEntityId === legalEntityId)?.legalEntityName;
  if (onPage) return onPage;
  const entity = await getAdminLegalEntityById(legalEntityId).catch(() => null);
  return entity?.displayName?.trim() || null;
}

export async function loadAdminPayoutsListPage(sp: PayoutsListSearch) {
  const query = payoutsListController.parseQuery(sp);
  const search = plainSearch(sp);

  const [sessionUser, navCounts] = await Promise.all([
    getServerSessionUser().catch(() => null),
    getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS),
  ]);
  const role = (sessionUser?.role ?? "client") as UserRole;
  const staffRoles = sessionUser?.staffRoles;
  const base = {
    search,
    view: activePayoutsView(search),
    capabilities: {
      canProcess: userHasAccessTo(role, staffRoles, PAYOUT_PROCESS_ACCESS),
      canReverse: userHasAccessTo(role, staffRoles, PAYOUT_REVERSE_ACCESS),
    },
    disputesOpen: navCounts.disputesOpen,
    exportFilters: payoutsListController.exportFilters?.(query) ?? {},
    pageSize: query.limit,
  };

  try {
    const page = await payoutsListController.fetchPage(query);
    // Seller names come with the rows; only a filtered seller with no row here is looked up.
    const filterName = await sellerFilterName(query.legalEntityId, page.rows);
    const rows = toPayoutsStaffRows(page.rows);
    const { offset, limit } = query;
    return {
      ...base,
      rows,
      summary: page.summary,
      sellerFilterName: filterName,
      loadError: null as string | null,
      pagination:
        rows.length > 0
          ? {
              summary: payoutsRangeSummary(offset, rows.length, page.total),
              prevHref:
                offset > 0
                  ? payoutsListHref(search, { offset: Math.max(0, offset - limit) })
                  : null,
              nextHref:
                offset + rows.length < page.total
                  ? payoutsListHref(search, { offset: offset + limit })
                  : null,
            }
          : null,
    };
  } catch {
    return {
      ...base,
      rows: [],
      summary: EMPTY_ADMIN_PAYOUT_LIST_SUMMARY,
      sellerFilterName: null,
      loadError: PAYOUTS_LOAD_ERROR as string | null,
      pagination: null,
    };
  }
}

export type AdminPayoutsListPage = Awaited<ReturnType<typeof loadAdminPayoutsListPage>>;
