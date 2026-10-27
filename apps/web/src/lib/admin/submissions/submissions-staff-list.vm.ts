import type { SubmissionDecisionQueue } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { AdminSubmissionTableRow } from "@/lib/admin/catalog/submission-table-row";
import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminSubmissionsListSummary } from "@/lib/data/http/admin-submissions-summary.server";
import {
  type AttentionStripItem,
  type Metric,
  type DataView as StaffDataView,
  type StatusPresentation,
  type TeamView,
  viewQuery,
} from "@auction/staff-ui";
import type { ItemSubmissionStatus } from "@auction/types";

export const SUBMISSIONS_LIST_PATH = "/admin/submissions";

export type SubmissionsListSearch = Record<string, string | string[] | undefined>;

/** One submission as the staff list shows it; plain data, so it crosses to the client as is. */
export type SubmissionsStaffRow = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  category: string | null;
  seller: string;
  statusCode: ItemSubmissionStatus;
  status: StatusPresentation;
  /** "9 days waiting", in the danger tone once it is over the review target. */
  waiting: StatusPresentation | null;
  waitingDays: number | null;
  /** What stops it being accepted, or what is worth checking: "Missing dimensions". */
  quality: StatusPresentation | null;
  /** Required details are missing, so it cannot be accepted yet. */
  blocksAccept: boolean;
  /** Each missing or doubtful detail, required ones first. */
  gaps: Array<{ id: string; label: string; description: string; required: boolean }>;
  assignee: string | null;
  assignedToMe: boolean;
  submittedAt: string;
  href: string;
  decisionHref: string;
};

const count = new Intl.NumberFormat("en-GB");

export function toSubmissionsStaffRows(
  rows: readonly AdminSubmissionTableRow[],
): SubmissionsStaffRow[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    thumbnailUrl: row.thumbnailUrl,
    category: row.categoryPreview,
    seller: row.sellerPreview,
    statusCode: row.status,
    status: staffStatus("submission", row.status),
    waiting:
      row.slaLabel && row.slaTone
        ? {
            label: row.slaLabel,
            tone:
              row.slaTone === "red" ? "danger" : row.slaTone === "amber" ? "warning" : "neutral",
          }
        : null,
    waitingDays: row.slaDays,
    quality: row.qualitySummaryLabel
      ? { label: row.qualitySummaryLabel, tone: row.blocksAccept ? "danger" : "warning" }
      : null,
    blocksAccept: row.blocksAccept,
    gaps: [...row.qualityGaps]
      .sort((a, b) => Number(b.severity === "required") - Number(a.severity === "required"))
      .map((gap) => ({
        id: gap.id,
        label: gap.label,
        description: gap.description,
        required: gap.severity === "required",
      })),
    assignee: row.isUnassigned ? null : row.assigneeLabel,
    assignedToMe: row.isAssignedToCurrentUser,
    submittedAt: row.createdAtIso,
    href: `${SUBMISSIONS_LIST_PATH}/${row.id}`,
    decisionHref: `${SUBMISSIONS_LIST_PATH}/${row.id}/decision`,
  }));
}

/** The list URL with `patch` applied; any change returns to the first page. */
export function submissionsListHref(
  current: SubmissionsListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: SubmissionsListSearch = { ...current };
  for (const key of ["error", "success", "submission", "preview"]) delete base[key];
  return buildListHref(SUBMISSIONS_LIST_PATH, base, { offset: null, ...patch });
}

/** The list with a submission's panel open (`?submission=`), or closed for null. */
export function submissionPanelHref(current: SubmissionsListSearch, id: string | null): string {
  const base: SubmissionsListSearch = { ...current };
  for (const key of ["error", "success", "preview"]) delete base[key];
  return buildListHref(SUBMISSIONS_LIST_PATH, base, { submission: id });
}

/** The panel to open on load: `?submission=`, or the older `?preview=` links. */
export function submissionPanelId(search: SubmissionsListSearch): string | null {
  for (const key of ["submission", "preview"]) {
    const value = search[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

const QUEUES: ReadonlyArray<{ id: SubmissionDecisionQueue; label: string }> = [
  { id: "awaiting", label: "Awaiting decision" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
];

/** The decision queues as view tabs, each with its count. */
export function submissionsViews(
  search: SubmissionsListSearch,
  summary: AdminSubmissionsListSummary | null,
): StaffDataView[] {
  return QUEUES.map((queue) => {
    const total = summary?.queueCounts[queue.id];
    return {
      id: queue.id,
      label: queue.label,
      href: submissionsListHref(search, { queue: queue.id === "awaiting" ? null : queue.id }),
      ...(total !== undefined ? { count: total } : {}),
    };
  });
}

/** The views every specialist starts with, beside the ones each person saves. */
export function submissionsTeamViews(): TeamView[] {
  const view = (id: string, label: string, patch: Record<string, string>) => {
    const [path, rest = ""] = submissionsListHref({}, patch).split("?");
    const query = viewQuery(rest);
    return { id: `team-${id}`, label, href: `${path}?${query}`, query };
  };
  return [
    view("waiting-longest", "Waiting longest", { sort: "sla" }),
    view("assigned-to-me", "Assigned to me", { assignedTo: "me" }),
    view("missing-details", "Missing details", { qualityGaps: "1" }),
  ];
}

/** Work waiting on the specialists, each linking to the view that holds it. */
export function submissionsAttention(
  search: SubmissionsListSearch,
  summary: AdminSubmissionsListSummary,
): AttentionStripItem[] {
  const over = summary.overSla;
  const mine = summary.assignedToMe;
  return [
    {
      id: "over-sla",
      count: over,
      label:
        over === 1
          ? "submission has waited more than 7 days"
          : "submissions have waited more than 7 days",
      href: submissionsListHref(search, { queue: null, sort: "sla" }),
      actionLabel: "Oldest first",
      tone: "danger",
    },
    {
      id: "mine",
      count: mine,
      label: mine === 1 ? "submission is assigned to you" : "submissions are assigned to you",
      href: submissionsListHref(search, { queue: null, assignedTo: "me" }),
      actionLabel: "Show mine",
    },
  ];
}

/** Headline numbers for the review desk, from the submissions summary. */
export function submissionsMetrics(summary: AdminSubmissionsListSummary): Metric[] {
  const age = summary.avgQueueAgeDays;
  return [
    { id: "awaiting", label: "Awaiting decision", value: count.format(summary.awaitingReview) },
    { id: "gaps", label: "Missing details", value: count.format(summary.qualityGaps) },
    { id: "reviewed", label: "Decided today", value: count.format(summary.reviewedToday) },
    {
      id: "age",
      label: "Average wait",
      value:
        age === null
          ? "None waiting"
          : `${count.format(Math.round(age))} ${Math.round(age) === 1 ? "day" : "days"}`,
    },
  ];
}

export const SUBMISSION_FLAG_FILTERS = [
  { value: "assignedToMe", label: "Assigned to me" },
  { value: "qualityGaps", label: "Missing details only" },
] as const;

/** The filters in force beyond the tab, as chips, the search included; the sort has its own control. */
export function submissionsFilterChips(chips: readonly CatalogActiveFilterChip[]) {
  return chips
    .filter((chip) => chip.id !== "sort")
    .map((chip) => ({
      id: chip.id,
      label: chip.id === "qualityGaps" ? "Missing details only" : chip.label,
      clearHref: chip.clearHref,
    }));
}

/** Newest first by default; "sla" is the server's oldest-waiting-first order. */
export const SUBMISSIONS_DEFAULT_SORT = { columnId: "submitted", direction: "desc" as const };

export function submissionsSortState(sort: string | undefined) {
  return sort === "sla"
    ? { columnId: "waiting", direction: "desc" as const }
    : SUBMISSIONS_DEFAULT_SORT;
}

export function submissionsSortHref(
  current: SubmissionsListSearch,
  sort: { columnId: string; direction: "asc" | "desc" },
): string {
  return submissionsListHref(current, { sort: sort.columnId === "waiting" ? "sla" : null });
}

/** "1–50 of 312 submissions". */
export function submissionsRangeSummary(offset: number, shown: number, total: number) {
  const range = `${count.format(offset + 1)}–${count.format(offset + shown)}`;
  return `${range} of ${count.format(total)} ${total === 1 ? "submission" : "submissions"}`;
}

/**
 * The bulk operations that apply to every chosen submission: accept and reject need each one to
 * be under review, and accept also needs each one complete.
 */
export function bulkSubmissionOperationIds(
  rows: ReadonlyArray<Pick<SubmissionsStaffRow, "statusCode" | "blocksAccept">>,
): Array<"approve" | "reject"> {
  if (rows.length === 0 || rows.some((row) => row.statusCode !== "under_review")) return [];
  return rows.some((row) => row.blocksAccept) ? ["reject"] : ["approve", "reject"];
}
