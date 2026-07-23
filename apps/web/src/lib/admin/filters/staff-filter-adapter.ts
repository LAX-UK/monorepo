import {
  hrefFromSearchParams,
  mergeFilterSearchParams,
} from "@/lib/admin/filters/merge-filter-params";
import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";

export type StaffFilterDraft = {
  staffRole: string;
  suspended: string;
};

function parseDraft(
  searchParams: URLSearchParams,
  _preserved: AdminFilterPreserved,
): StaffFilterDraft {
  return {
    staffRole: searchParams.get("staffRole")?.trim() ?? "",
    suspended: searchParams.get("suspended")?.trim() ?? "",
  };
}

export const staffFilterAdapter: AdminFilterAdapter<StaffFilterDraft> = {
  parse: parseDraft,
  defaults: () => ({
    staffRole: "",
    suspended: "",
  }),
  buildHref(pathname, current, draft, preserved) {
    const params = mergeFilterSearchParams(
      current,
      {
        staffRole: draft.staffRole.trim() || null,
        suspended: draft.suspended.trim() || null,
      },
      preserved,
    );
    return hrefFromSearchParams(pathname, params);
  },
  isDirty(draft, applied) {
    return draft.staffRole !== applied.staffRole || draft.suspended !== applied.suspended;
  },
};
