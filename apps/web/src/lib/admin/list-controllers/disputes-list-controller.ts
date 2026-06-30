import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import { getAdminDisputesPage } from "@/lib/data/http/disputes.server";
import type { AdminDisputeTableRow } from "@/lib/data/view-models/admin-disputes-table.vm";

export type DisputesListQuery = AdminListQueryBase & {
  status?: "open" | "under_review" | "closed" | undefined;
};

export const disputesListController: IAdminListController<AdminDisputeTableRow, DisputesListQuery> =
  {
    id: "disputes",
    parseQuery(sp) {
      const base = parseListSearchParams(sp);
      const statusRaw = firstString(sp.status);
      const status =
        statusRaw === "open" || statusRaw === "under_review" || statusRaw === "closed"
          ? statusRaw
          : undefined;
      return { ...base, limit: Math.min(200, base.limit), status };
    },
    async fetch(q) {
      const result = await getAdminDisputesPage({
        limit: q.limit,
        offset: q.offset,
        ...(q.status !== undefined ? { status: q.status } : {}),
      });
      return {
        rows: result.rows,
        offset: q.offset,
        limit: q.limit,
        hasNextPage: result.hasNextPage,
        summary: result.summary,
      };
    },
  };
