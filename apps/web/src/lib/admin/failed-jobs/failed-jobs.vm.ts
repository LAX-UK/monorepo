import type { StaffStatusTone } from "@auction/staff-ui";
import {
  FAILED_JOB_VIEW_IDS,
  FAILED_JOB_VIEW_LABELS,
  type FailedJobList,
  type FailedJobSourceFamily,
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

/** What the empty list says when only integrations are in view (a filter, or Finance's own page). */
const INTEGRATIONS_EMPTY: Readonly<Record<FailedJobView, { title: string; description: string }>> =
  {
    needs_review: {
      title: "No integration failures need review",
      description:
        "Every delivery to Xero, Zoho and every inbound webhook has gone through or been set aside. New failures appear here.",
    },
    retried: {
      title: "No retried deliveries",
      description: "Deliveries you retry from Needs review move here.",
    },
    discarded: {
      title: "No discarded deliveries",
      description: "Deliveries you set aside with a reason move here, and can be restored.",
    },
  };

/** The empty-state wording for a view, in the words of the kind of failure being shown. */
export function failedJobsEmpty(
  view: FailedJobView,
  source: FailedJobSourceFamily | "",
): { title: string; description: string } {
  return source === "integrations" ? INTEGRATIONS_EMPTY[view] : FAILED_JOBS_EMPTY[view];
}

/**
 * "1–50 of 312 jobs" under the table; "3 jobs" when the whole list fits. Identical failures on
 * the page are folded into rows, so it also says how many rows that makes: "4 groups · 16 jobs".
 */
export function pageSummary(
  offset: number,
  shown: number,
  total: number,
  options: { groups?: number; noun?: { one: string; other: string } } = {},
): string {
  if (shown === 0) return "";
  const noun = options.noun ?? { one: "job", other: "jobs" };
  const first = offset + 1;
  const last = offset + shown;
  const fits = first === 1 && last === total;
  const grouped = options.groups !== undefined && options.groups < shown;
  const jobs = `${total} ${total === 1 ? noun.one : noun.other}`;
  if (fits) {
    return grouped
      ? `${options.groups} ${options.groups === 1 ? "group" : "groups"} · ${jobs}`
      : jobs;
  }
  const range = `${first}–${last} of ${jobs}`;
  return grouped ? `${range} · ${options.groups} groups` : range;
}
