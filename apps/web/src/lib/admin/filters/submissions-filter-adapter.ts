import {
  hrefFromSearchParams,
  mergeFilterSearchParams,
} from "@/lib/admin/filters/merge-filter-params";
import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";

export type SubmissionsFilterDraft = {
  q: string;
  categoryId: string;
  assignedToMe: boolean;
  sortBySla: boolean;
  qualityGaps: boolean;
};

function parseDraft(
  searchParams: URLSearchParams,
  _preserved: AdminFilterPreserved,
): SubmissionsFilterDraft {
  return {
    q: searchParams.get("q")?.trim() ?? "",
    categoryId: searchParams.get("categoryId")?.trim() ?? "",
    assignedToMe: searchParams.get("assignedTo") === "me",
    sortBySla: searchParams.get("sort") === "sla",
    qualityGaps: searchParams.get("qualityGaps") === "1",
  };
}

export const submissionsFilterAdapter: AdminFilterAdapter<SubmissionsFilterDraft> = {
  parse: parseDraft,
  defaults: () => ({
    q: "",
    categoryId: "",
    assignedToMe: false,
    sortBySla: false,
    qualityGaps: false,
  }),
  buildHref(pathname, current, draft, preserved) {
    const params = mergeFilterSearchParams(
      current,
      {
        q: draft.q.trim() || null,
        categoryId: draft.categoryId.trim() || null,
        assignedTo: draft.assignedToMe ? "me" : null,
        sort: draft.sortBySla ? "sla" : null,
        qualityGaps: draft.qualityGaps ? "1" : null,
      },
      preserved,
    );
    return hrefFromSearchParams(pathname, params);
  },
  isDirty(draft, applied) {
    return (
      draft.q !== applied.q ||
      draft.categoryId !== applied.categoryId ||
      draft.assignedToMe !== applied.assignedToMe ||
      draft.sortBySla !== applied.sortBySla ||
      draft.qualityGaps !== applied.qualityGaps
    );
  },
};
