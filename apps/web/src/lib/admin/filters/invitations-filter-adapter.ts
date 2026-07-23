import {
  hrefFromSearchParams,
  mergeFilterSearchParams,
} from "@/lib/admin/filters/merge-filter-params";
import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";

export type InvitationsFilterDraft = {
  status: string;
};

function parseDraft(
  searchParams: URLSearchParams,
  _preserved: AdminFilterPreserved,
): InvitationsFilterDraft {
  return {
    status: searchParams.get("status")?.trim() ?? "",
  };
}

export const invitationsFilterAdapter: AdminFilterAdapter<InvitationsFilterDraft> = {
  parse: parseDraft,
  defaults: () => ({
    status: "",
  }),
  buildHref(pathname, current, draft, preserved) {
    const params = mergeFilterSearchParams(
      current,
      {
        status: draft.status.trim() || null,
      },
      preserved,
    );
    return hrefFromSearchParams(pathname, params);
  },
  isDirty(draft, applied) {
    return draft.status !== applied.status;
  },
};
