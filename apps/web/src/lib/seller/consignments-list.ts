import {
  type ReviewStage,
  parseReviewStage,
} from "@/lib/organisation-home/consignment-stage-links";
import { matchesEveryWord, searchParam } from "@/lib/workspace/list-search";
import type { ConsignmentRecord } from "./consignment-records";
import {
  CONSIGNMENT_STAGES,
  CONSIGNMENT_STAGE_LABEL,
  CONSIGNMENT_STATUS,
  type ConsignmentOpenStage,
  NEEDS_CHANGES_LABEL,
} from "./consignment-status";

/**
 * The list's views: everything, what waits on the member, then the stages in order. Closed work
 * (not accepted, withdrawn) shows only under All.
 */
export const CONSIGNMENT_VIEWS = [
  "all",
  "needs-you",
  ...CONSIGNMENT_STAGES.map((stage) => stage.id),
] as const satisfies readonly ("all" | "needs-you" | ConsignmentOpenStage)[];
export type ConsignmentView = "all" | "needs-you" | ConsignmentOpenStage;

export const CONSIGNMENT_VIEW_LABEL: Record<ConsignmentView, string> = {
  all: "All",
  "needs-you": "Needs you",
  ...CONSIGNMENT_STAGE_LABEL,
};

export const CONSIGNMENT_SORTS = ["updated", "sent"] as const;
export type ConsignmentSort = (typeof CONSIGNMENT_SORTS)[number];

export const CONSIGNMENT_SORT_LABEL: Record<ConsignmentSort, string> = {
  updated: "Last updated",
  sent: "Date sent",
};

/** What the list shows, as written in the address so a view can be shared. */
export type ConsignmentsListQuery = {
  view: ConsignmentView;
  q: string;
  sentBy: string | null;
  /** From Home's "Needs changes" link; it narrows In review to the works sent back. */
  stage: ReviewStage | null;
  sort: ConsignmentSort;
};

/** Views from before the list had Needs you, so old links keep their meaning. */
const LEGACY_VIEWS: Partial<Record<string, ConsignmentView>> = {
  closed: "all",
  draft: "drafts",
  submitted: "in-review",
  under_review: "in-review",
  approved: "accepted",
  converted: "accepted",
  rejected: "all",
  withdrawn: "all",
};

function oneOf<T extends string>(values: readonly T[], raw: string | null): T | null {
  return raw && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

/** `fallbackView` opens when the address names none: Needs you while anything waits. */
export function parseConsignmentsListQuery(
  params: Readonly<Record<string, string | string[] | undefined>>,
  fallbackView: ConsignmentView = "all",
): ConsignmentsListQuery {
  const raw = searchParam(params.tab) ?? searchParam(params.status);
  const view =
    oneOf(CONSIGNMENT_VIEWS, raw) ?? (raw ? LEGACY_VIEWS[raw] : undefined) ?? fallbackView;
  return {
    view,
    q: searchParam(params.q) ?? "",
    sentBy: searchParam(params.sentBy),
    stage: view === "in-review" ? parseReviewStage(searchParam(params.stage) ?? undefined) : null,
    sort: oneOf(CONSIGNMENT_SORTS, searchParam(params.sort)) ?? "updated",
  };
}

/** The address of a list query; the view is always written, the defaults are left out. */
export function consignmentsListSearch(query: ConsignmentsListQuery): string {
  const params = new URLSearchParams({ tab: query.view });
  if (query.q) params.set("q", query.q);
  if (query.sentBy) params.set("sentBy", query.sentBy);
  if (query.stage && query.view === "in-review") params.set("stage", query.stage);
  if (query.sort !== "updated") params.set("sort", query.sort);
  return `?${params.toString()}`;
}

function inView(record: ConsignmentRecord, view: ConsignmentView): boolean {
  if (view === "all") return true;
  if (view === "needs-you") return record.task !== null;
  return record.stage === view;
}

/** Narrowed by search, sender and stage, whatever the view. */
function matches(record: ConsignmentRecord, query: ConsignmentsListQuery): boolean {
  if (query.sentBy && record.sentBy !== query.sentBy) return false;
  if (query.stage && record.progress !== query.stage) return false;
  return matchesEveryWord(
    [
      record.title,
      record.reference,
      record.sentBy,
      record.saleTitle,
      CONSIGNMENT_STATUS[record.status].label,
      record.stage === "closed" ? "" : CONSIGNMENT_STAGE_LABEL[record.stage],
    ],
    query.q,
  );
}

const SORTERS: Record<ConsignmentSort, (a: ConsignmentRecord, b: ConsignmentRecord) => number> = {
  updated: (a, b) => b.changedAt - a.changedAt,
  sent: (a, b) => b.sentAt - a.sentAt,
};

export function consignmentsInView(
  records: readonly ConsignmentRecord[],
  query: ConsignmentsListQuery,
): ConsignmentRecord[] {
  return records
    .filter((record) => inView(record, query.view) && matches(record, query))
    .sort(SORTERS[query.sort]);
}

/** Each view's count after search and filters, so a tab says what it holds now. */
export function consignmentViewCounts(
  records: readonly ConsignmentRecord[],
  query: ConsignmentsListQuery,
): Record<ConsignmentView, number> {
  const narrowed = records.filter((record) => matches(record, query));
  return Object.fromEntries(
    CONSIGNMENT_VIEWS.map((view) => [view, narrowed.filter((r) => inView(r, view)).length]),
  ) as Record<ConsignmentView, number>;
}

/** Opens Needs you while anything waits on the member, else everything. */
export function defaultConsignmentView(records: readonly ConsignmentRecord[]): ConsignmentView {
  return records.some((record) => record.task !== null) ? "needs-you" : "all";
}

export type ConsignmentFilterKey = "sentBy" | "stage";

export function appliedConsignmentFilters(
  query: ConsignmentsListQuery,
): { id: ConsignmentFilterKey; label: string }[] {
  const chips: { id: ConsignmentFilterKey; label: string }[] = [];
  if (query.sentBy) chips.push({ id: "sentBy", label: `Sent by: ${query.sentBy}` });
  if (query.stage) chips.push({ id: "stage", label: NEEDS_CHANGES_LABEL });
  return chips;
}

export function isConsignmentListNarrowed(query: ConsignmentsListQuery): boolean {
  return Boolean(query.q || query.sentBy || query.stage);
}

/** The members who sent anything, for the "Sent by" filter. */
export function consignmentSenders(records: readonly ConsignmentRecord[]): string[] {
  return [...new Set(records.flatMap((r) => (r.sentBy ? [r.sentBy] : [])))].sort((a, b) =>
    a.localeCompare(b),
  );
}
