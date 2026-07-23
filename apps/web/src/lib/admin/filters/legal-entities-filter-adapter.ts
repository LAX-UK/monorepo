import {
  hrefFromSearchParams,
  mergeFilterSearchParams,
} from "@/lib/admin/filters/merge-filter-params";
import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";

export type LegalEntitiesFilterDraft = {
  status: string;
  kind: string;
};

function parseDraft(
  searchParams: URLSearchParams,
  _preserved: AdminFilterPreserved,
): LegalEntitiesFilterDraft {
  return {
    status: searchParams.get("status")?.trim() ?? "",
    kind: searchParams.get("kind")?.trim() ?? "",
  };
}

export const legalEntitiesFilterAdapter: AdminFilterAdapter<LegalEntitiesFilterDraft> = {
  parse: parseDraft,
  defaults: () => ({
    status: "",
    kind: "",
  }),
  buildHref(pathname, current, draft, preserved) {
    const params = mergeFilterSearchParams(
      current,
      {
        status: draft.status.trim() || null,
        kind: draft.kind.trim() || null,
      },
      preserved,
    );
    return hrefFromSearchParams(pathname, params);
  },
  isDirty(draft, applied) {
    return draft.status !== applied.status || draft.kind !== applied.kind;
  },
};
