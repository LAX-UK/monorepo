import { buildListHref } from "@/lib/admin/admin-list-params";
import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";

export const CONDITION_REPORTS_LIST_PATH = "/admin/condition-reports";

export type ConditionReportsListSearchParams = {
  error?: string;
  success?: string;
  limit?: string;
  offset?: string;
  lens?: string;
  request?: string;
};

type ConditionReportLens = "open" | "pending" | "in_progress" | "fulfilled" | "declined";

function parseConditionReportLens(raw: string | undefined): ConditionReportLens {
  const st = firstString(raw);
  if (st === "pending" || st === "in_progress" || st === "fulfilled" || st === "declined") {
    return st;
  }
  return "open";
}

export function buildConditionReportsListPageModel(sp: ConditionReportsListSearchParams) {
  const base = parseListSearchParams(sp);
  const limit = Math.min(80, Math.max(1, base.limit));
  const offset = Math.max(0, base.offset);
  const lens = parseConditionReportLens(firstString(sp.lens));
  const selectedRequestId = sp.request?.trim() || undefined;

  const listQueryParams = {
    limit,
    offset,
    status: lens,
  };

  return {
    basePath: CONDITION_REPORTS_LIST_PATH,
    query: { offset, limit, lens },
    listQueryParams,
    selectedRequestId,
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(CONDITION_REPORTS_LIST_PATH, sp, patch),
    buildDrawerHref: (requestId: string | null) =>
      buildListHref(
        CONDITION_REPORTS_LIST_PATH,
        sp,
        requestId ? { request: requestId } : { request: "" },
      ),
  };
}

export type ConditionReportsListPageModel = ReturnType<typeof buildConditionReportsListPageModel>;
