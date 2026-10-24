import { firstString } from "@/lib/admin/admin-list-params";
import { parseStaffPageSize } from "@auction/staff-ui";

export const AML_LIST_PATH = "/admin/compliance/aml";

export type AmlListSearchParams = {
  limit?: string;
  offset?: string;
  screening?: string;
};

/** The list's URL state: page size and offset, and the screening whose panel is open. */
export function buildAmlListPageModel(sp: AmlListSearchParams) {
  const limit = parseStaffPageSize(firstString(sp.limit));
  const offset = Math.max(0, Number.parseInt(firstString(sp.offset) ?? "0", 10) || 0);
  const selectedScreeningId = firstString(sp.screening)?.trim() || undefined;
  return {
    query: { offset, limit },
    listQueryParams: { limit, offset },
    selectedScreeningId,
  };
}

export type AmlListPageModel = ReturnType<typeof buildAmlListPageModel>;
