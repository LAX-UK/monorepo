import type { StaffStatusTone } from "@auction/staff-ui";
import {
  FAILED_JOB_VIEW_IDS,
  FAILED_JOB_VIEW_LABELS,
  type FailedJobList,
  type FailedJobState,
  type FailedJobView,
} from "@auction/types";

/** How a job's state reads as a badge; one table, so a new state is one more row. */
export const FAILED_JOB_STATE_BADGE: Readonly<
  Record<FailedJobState, { label: string; tone: StaffStatusTone }>
> = {
  needs_review: { label: "Needs review", tone: "danger" },
  retried: { label: "Retried", tone: "info" },
  discarded: { label: "Discarded", tone: "neutral" },
};

export type FailedJobsViewTab = { id: FailedJobView; label: string; count: number };

/** The view tabs with the counts the API gave for the current filters. */
export function failedJobsViewTabs(counts: FailedJobList["counts"]): FailedJobsViewTab[] {
  return FAILED_JOB_VIEW_IDS.map((id) => ({
    id,
    label: FAILED_JOB_VIEW_LABELS[id],
    count: counts[id],
  }));
}

export const FAILED_JOBS_EMPTY: Readonly<
  Record<FailedJobView, { title: string; description: string }>
> = {
  needs_review: {
    title: "No failed jobs need review",
    description:
      "Everything that ran out of attempts has been retried or set aside. New failures appear here.",
  },
  retried: {
    title: "No retried jobs",
    description: "Jobs you run again from Needs review move here.",
  },
  discarded: {
    title: "No discarded jobs",
    description: "Jobs you set aside with a reason move here, and can be restored.",
  },
};

/** "1–50 of 312 jobs" under the table; "3 jobs" when the whole list fits. */
export function pageSummary(offset: number, shown: number, total: number): string {
  if (shown === 0) return "";
  const first = offset + 1;
  const last = offset + shown;
  return first === 1 && last === total
    ? `${total} ${total === 1 ? "job" : "jobs"}`
    : `${first}–${last} of ${total} jobs`;
}
