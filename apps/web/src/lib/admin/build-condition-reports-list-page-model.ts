import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import { parseStaffPageSize } from "@auction/staff-ui";

export const CONDITION_REPORTS_LIST_PATH = "/admin/condition-reports";

export type ConditionReportsListSearchParams = Record<string, string | string[] | undefined>;

export type ConditionReportLens = "open" | "pending" | "in_progress" | "fulfilled" | "declined";

function parseConditionReportLens(raw: string | undefined): ConditionReportLens {
  if (raw === "pending" || raw === "in_progress" || raw === "fulfilled" || raw === "declined") {
    return raw;
  }
  return "open";
}

export function buildConditionReportsListPageModel(sp: ConditionReportsListSearchParams) {
  const { offset } = parseListSearchParams(sp);
  const limit = parseStaffPageSize(firstString(sp.limit));
  const lens = parseConditionReportLens(firstString(sp.lens));

  return {
    query: { offset, limit, lens },
    listQueryParams: { limit, offset, status: lens },
  };
}
