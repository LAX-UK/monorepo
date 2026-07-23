import {
  hrefFromSearchParams,
  mergeFilterSearchParams,
} from "@/lib/admin/filters/merge-filter-params";
import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";

export type VenuesFilterDraft = {
  legalEntityId: string;
};

function parseDraft(
  searchParams: URLSearchParams,
  _preserved: AdminFilterPreserved,
): VenuesFilterDraft {
  return {
    legalEntityId: searchParams.get("legalEntityId")?.trim() ?? "",
  };
}

export const venuesFilterAdapter: AdminFilterAdapter<VenuesFilterDraft> = {
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
