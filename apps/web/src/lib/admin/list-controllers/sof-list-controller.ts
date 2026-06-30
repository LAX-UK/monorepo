import { parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { IAdminListController } from "@/lib/admin/i-admin-list-controller";
import { type SofListQuery, parseSofListStatus } from "@/lib/admin/sof-list-query";
import { getAdminSourceOfFundsPage } from "@/lib/data/http/compliance.server";
import {
  type AdminSofTableRow,
  buildAdminSofTableRows,
} from "@/lib/data/view-models/admin-sof-table.vm";

export const sofListController: IAdminListController<AdminSofTableRow, SofListQuery> = {
  id: "sof",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    return {
      ...base,
      limit: Math.min(100, base.limit),
      status: parseSofListStatus(sp),
    };
  },
  async fetch(q) {
    const page = await getAdminSourceOfFundsPage({
      status: q.status,
      limit: q.limit,
      offset: q.offset,
    });
    const rows = buildAdminSofTableRows(page.rows);
    let rowsForSummary: AdminSofTableRow[] | undefined;
    if (q.status === "pending") {
      rowsForSummary =
        q.offset > 0
          ? buildAdminSofTableRows(
              (
                await getAdminSourceOfFundsPage({
                  status: "pending",
                  limit: 100,
                  offset: 0,
                })
              ).rows,
            )
          : rows;
    }
    return { rows, offset: q.offset, limit: q.limit, total: page.total, rowsForSummary };
  },
};
