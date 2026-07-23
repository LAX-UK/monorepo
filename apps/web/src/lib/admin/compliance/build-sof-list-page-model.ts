import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import {
  type SofListStatus,
  buildSofStatusChips,
  parseSofListStatus,
} from "@/lib/admin/sof-list-query";

export const SOF_LIST_PATH = "/admin/compliance/source-of-funds";

export type SofListSearchParams = {
  error?: string;
  success?: string;
  limit?: string;
  offset?: string;
  status?: string;
  case?: string;
};

export function buildSofListPageModel(sp: SofListSearchParams) {
  const limit = Math.min(100, Math.max(1, Number(sp.limit ?? 100) || 100));
  const offset = Math.max(0, Number(sp.offset ?? 0) || 0);
  const status = parseSofListStatus(sp);

  const listQueryParams = { status, limit, offset };
  const statusChipSpecs = buildSofStatusChips(SOF_LIST_PATH, sp, status);

  return {
    basePath: SOF_LIST_PATH,
    query: { offset, limit, status },
    listQueryParams,
    listReturnTarget: buildAdminListReturnTarget(SOF_LIST_PATH, sp),
    statusChipSpecs,
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(SOF_LIST_PATH, sp, patch),
  };
}

export type SofListPageModel = ReturnType<typeof buildSofListPageModel>;

export function sofEmptyStateCopy(status: SofListStatus) {
  if (status === "rejected") {
    return {
      title: "No rejected cases",
      description:
        "Rejected cases stay blocking until manually reopened when the buyer supplies new evidence.",
    };
  }
  if (status === "approved") {
    return {
      title: "No approved cases",
      description:
        "Approved cases clear the settlement gate for the buyer, subject to validity and exposure limits.",
    };
  }
  return {
    title: "No pending Source of Funds cases",
    description: "Cases open when a buyer crosses the SoF threshold without a valid approval.",
  };
}
