import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import {
  type AdminConditionReportRequestRow,
  getAdminConditionReportRequests,
} from "@/lib/data/http/admin.server";

export type ConditionReportsListQuery = AdminListQueryBase & {
  lens?: "open" | "pending" | "in_progress" | "fulfilled" | "declined";
};

type ConditionReportLens = NonNullable<ConditionReportsListQuery["lens"]>;

function parseConditionReportLens(raw: string | undefined): ConditionReportLens {
  const st = firstString(raw);
  if (st === "pending" || st === "in_progress" || st === "fulfilled" || st === "declined") {
    return st;
  }
  return "open";
}

export const conditionReportsListController: IAdminListController<
  AdminConditionReportRequestRow,
  ConditionReportsListQuery
> = {
  id: "condition-reports",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    return {
      ...base,
      limit: Math.min(80, base.limit),
      lens: parseConditionReportLens(firstString(sp.lens)),
    };
  },
  async fetch(q) {
    const lens = q.lens ?? "open";
    const status =
      lens === "open" ||
      lens === "pending" ||
      lens === "in_progress" ||
      lens === "fulfilled" ||
      lens === "declined"
        ? lens
        : undefined;
    const { items, total, limit, offset } = await getAdminConditionReportRequests({
      ...(status ? { status } : {}),
      limit: q.limit,
      offset: q.offset,
    });
    return { rows: items, total, limit, offset };
  },
};
