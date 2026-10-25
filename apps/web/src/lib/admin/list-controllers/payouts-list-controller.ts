import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import {
  type AdminListQueryBase,
  type IAdminListController,
  listExportFilters,
} from "@/lib/admin/i-admin-list-controller";
import { getAdminPayoutsPage } from "@/lib/data/http/admin-payouts.reader";
import type { AdminPayoutListSummary } from "@/lib/data/http/admin-payouts.shared";
import type { AdminPayoutRow } from "@/lib/data/http/admin.server";
import { parseStaffPageSize } from "@auction/staff-ui";
import { type PayoutStatus, payoutStatuses } from "@auction/types";

export type PayoutsListQuery = AdminListQueryBase & {
  status?: PayoutStatus | undefined;
  /** Narrows the list to one seller, from a link on the legal entity. */
  legalEntityId?: string | undefined;
};

export type PayoutsListResult = {
  rows: AdminPayoutRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminPayoutListSummary;
};

function isPayoutStatus(value: string | undefined): value is PayoutStatus {
  return value !== undefined && (payoutStatuses as readonly string[]).includes(value);
}

export const payoutsListController: IAdminListController<AdminPayoutRow, PayoutsListQuery> & {
  fetchPage(query: PayoutsListQuery): Promise<PayoutsListResult>;
} = {
  id: "payouts",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const status = firstString(sp.status);
    const legalEntityId = firstString(sp.legalEntityId)?.trim();
    return {
      ...base,
      limit: parseStaffPageSize(firstString(sp.limit)),
      status: isPayoutStatus(status) ? status : undefined,
      legalEntityId: legalEntityId || undefined,
    };
  },
  exportFilters(query) {
    return listExportFilters({ status: query.status, legalEntityId: query.legalEntityId });
  },
  async fetchPage(query) {
    const page = await getAdminPayoutsPage({
      limit: query.limit,
      offset: query.offset,
      ...(query.status ? { status: query.status } : {}),
      ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    });
    return {
      rows: page.rows,
      total: page.total,
      offset: page.offset,
      limit: page.limit,
      summary: page.summary,
    };
  },
  async fetch(query) {
    const page = await payoutsListController.fetchPage(query);
    return { rows: page.rows, total: page.total, offset: page.offset, limit: page.limit };
  },
};
