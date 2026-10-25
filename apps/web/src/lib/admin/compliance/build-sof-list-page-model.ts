import { firstString } from "@/lib/admin/admin-list-params";
import { buildAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import { parseSofListStatus } from "@/lib/admin/sof-list-query";
import { parseStaffPageSize } from "@auction/staff-ui";

export const SOF_LIST_PATH = "/admin/compliance/source-of-funds";

export type SofListSearchParams = {
  limit?: string;
  offset?: string;
  status?: string;
  case?: string;
};

/** The list's URL state: the status view, the page size and the offset. */
export function buildSofListPageModel(sp: SofListSearchParams) {
  const limit = parseStaffPageSize(firstString(sp.limit));
  const offset = Math.max(0, Number.parseInt(firstString(sp.offset) ?? "0", 10) || 0);
  const status = parseSofListStatus(sp);

  return {
    query: { offset, limit, status },
    listQueryParams: { status, limit, offset },
    /** Where "back to the list" from a case page returns to. */
    listReturnTarget: buildAdminListReturnTarget(SOF_LIST_PATH, sp),
  };
}

export type SofListPageModel = ReturnType<typeof buildSofListPageModel>;
