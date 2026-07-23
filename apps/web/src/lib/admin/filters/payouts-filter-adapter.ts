import {
  hrefFromSearchParams,
  mergeFilterSearchParams,
} from "@/lib/admin/filters/merge-filter-params";
import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";

export type PayoutsFilterDraft = {
  legalEntityId: string;
};

function parseDraft(
  searchParams: URLSearchParams,
  _preserved: AdminFilterPreserved,
): PayoutsFilterDraft {
  return {
    legalEntityId: searchParams.get("legalEntityId")?.trim() ?? "",
  };
}

export const payoutsFilterAdapter: AdminFilterAdapter<PayoutsFilterDraft> = {
  parse: parseDraft,
  defaults: () => ({
    legalEntityId: "",
  }),
  buildHref(pathname, current, draft, preserved) {
    const params = mergeFilterSearchParams(
      current,
      {
        legalEntityId: draft.legalEntityId.trim() || null,
      },
      preserved,
    );
    return hrefFromSearchParams(pathname, params);
  },
  isDirty(draft, applied) {
    return draft.legalEntityId !== applied.legalEntityId;
  },
};
