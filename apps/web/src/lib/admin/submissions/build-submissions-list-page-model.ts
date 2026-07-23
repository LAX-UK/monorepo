import {
  type SubmissionDecisionQueue,
  submissionsListController,
} from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { countActiveCatalogFilters } from "@/lib/admin/catalog-list-filter-utils";
import type { CatalogSegmentItem } from "@/lib/admin/catalog/types";
import { submissionsDecisionQueueHref } from "@/lib/admin/list-presets/submissions-presets";

export type SubmissionsListSearchParams = {
  queue?: string;
  error?: string;
  q?: string;
  categoryId?: string;
  qualityGaps?: string;
  assignedTo?: string;
  sort?: string;
  limit?: string;
  offset?: string;
};

const DECISION_TABS: { id: SubmissionDecisionQueue; label: string }[] = [
  { id: "awaiting", label: "Awaiting" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
];

export function buildSubmissionsListPageModel(sp: SubmissionsListSearchParams) {
  const query = submissionsListController.parseQuery(sp);
  const initialQ = query.q ?? "";
  const activeQueue = query.queue ?? "awaiting";

  const advancedFilterCount = countActiveCatalogFilters([
    initialQ.trim() !== "" ? initialQ : null,
    query.categoryId ?? null,
    query.qualityGaps ? "1" : null,
    query.assignedToMe ? "me" : null,
    query.sort ?? null,
  ]);

  const lenses: CatalogSegmentItem[] = DECISION_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    href: submissionsDecisionQueueHref(tab.id, sp),
  }));

  const hasListFilters =
    initialQ.trim() !== "" ||
    Boolean(query.categoryId) ||
    Boolean(query.qualityGaps) ||
    Boolean(query.assignedToMe) ||
    Boolean(query.sort);

  const exportFilters = {
    ...(activeQueue ? { queue: activeQueue } : {}),
    ...(initialQ ? { q: initialQ } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.qualityGaps ? { qualityGaps: "1" } : {}),
    ...(query.assignedToMe ? { assignedTo: "me" } : {}),
    ...(query.sort ? { sort: query.sort } : {}),
  };

  return {
    query,
    initialQ,
    activeQueue,
    advancedFilterCount,
    lenses,
    hasListFilters,
    exportFilters,
    decisionTabs: DECISION_TABS,
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref("/admin/submissions", sp, patch),
    clearTitleHref: buildListHref("/admin/submissions", sp, {
      q: "",
      offset: 0,
      queue: activeQueue,
    }),
    clearFiltersHref: buildListHref("/admin/submissions", sp, {
      categoryId: undefined,
      q: "",
      qualityGaps: "",
      assignedTo: "",
      sort: "",
      offset: 0,
      queue: activeQueue,
    }),
  };
}
