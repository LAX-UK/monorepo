import { parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import { getAdminAmlScreeningsPage } from "@/lib/data/http/compliance.server";
import {
  type AdminAmlTableRow,
  buildAdminAmlTableRows,
} from "@/lib/data/view-models/admin-aml-table.vm";

export const amlListController: IAdminListController<AdminAmlTableRow, AdminListQueryBase> = {
  id: "aml",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    return { ...base, limit: Math.min(100, base.limit) };
  },
  async fetch(q) {
    const page = await getAdminAmlScreeningsPage({ limit: q.limit, offset: q.offset });
    const rows = buildAdminAmlTableRows(page.rows);
    return { rows, offset: q.offset, limit: q.limit, total: page.total };
  },
};
