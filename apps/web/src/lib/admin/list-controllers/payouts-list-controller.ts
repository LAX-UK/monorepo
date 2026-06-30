import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import { type AdminPayoutRow, getAdminPayoutList } from "@/lib/data/http/admin.server";
import type { PayoutStatus } from "@auction/types";
import { payoutStatuses } from "@auction/types";

function parsePayoutListStatus(raw: string | undefined): PayoutStatus | undefined {
  const st = firstString(raw);
  if (!st || st === "all") return undefined;
  return (payoutStatuses as readonly string[]).includes(st) ? (st as PayoutStatus) : undefined;
}

export type PayoutsListQuery = AdminListQueryBase & {
  status?: PayoutStatus | undefined;
  legalEntityId?: string | undefined;
};

export const payoutsListController: IAdminListController<AdminPayoutRow, PayoutsListQuery> = {
  id: "payouts",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const status = parsePayoutListStatus(firstString(sp.status));
    const legalEntityId = firstString(sp.legalEntityId)?.trim() || undefined;
    // GET /admin/payouts rejects limit > 100; fetch uses limit+1 for hasNextPage.
    const limit = base.limit === 50 ? 99 : Math.min(99, base.limit);
    return { ...base, status, legalEntityId, limit };
  },
  async fetch(q) {
    const fetchLimit = Math.min(q.limit + 1, 100);
    const listParams = {
      limit: fetchLimit,
      offset: q.offset,
      ...(q.status ? { status: q.status } : {}),
      ...(q.legalEntityId ? { legalEntityId: q.legalEntityId } : {}),
    };
    const fetched = await getAdminPayoutList(listParams);
    const hasNextPage = fetched.length > q.limit;
    const rows = hasNextPage ? fetched.slice(0, q.limit) : fetched;

    const rowsForSummary =
      q.offset > 0
        ? await getAdminPayoutList({
            limit: 100,
            offset: 0,
            ...(q.status ? { status: q.status } : {}),
            ...(q.legalEntityId ? { legalEntityId: q.legalEntityId } : {}),
          })
        : fetched.slice(0, 100);

    return { rows, offset: q.offset, limit: q.limit, rowsForSummary, hasNextPage };
  },
};
