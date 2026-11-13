import type { IFailedJobNeedsReviewGroups } from "@auction/persistence/interfaces";
import type { AlertSink, WorkerAlert } from "../../lib/alert-sink.js";
import { toFailedJobGroups } from "./failed-job-group-key.js";
import {
  type FailedJobsAlert,
  type FailedJobsAlertConfig,
  type FailedJobsAlertState,
  decideFailedJobsAlert,
} from "./failed-jobs-alert-decision.js";

/** The Failed jobs alert: one message, which the Sentry alert rule matches on. */
export const FAILED_JOBS_ALERTS = {
  /** A new kind of failure, a kind that grew, or Needs review as a whole grew. */
  growing: { message: "failed_jobs_growing", level: "warning" },
} as const satisfies Record<string, WorkerAlert>;

export type FailedJobsAlertMessage = (typeof FAILED_JOBS_ALERTS)[keyof typeof FAILED_JOBS_ALERTS];

/** The watch's cron monitor key in `SENTRY_MONITOR_SLUGS`, like every other worker cron. */
export const FAILED_JOBS_CRON_MONITORS = { watch: "failed-jobs-watch" } as const;

/** Bid admin › Failed jobs, Needs review. */
export const FAILED_JOBS_PAGE = "/admin/failed-jobs?view=needs_review";

/** The most groups one alert lists; the rest are counted. */
const MAX_LISTED_GROUPS = 10;

/** What was alerted last, kept between runs. */
export interface FailedJobsAlertStateStore {
  read(): Promise<FailedJobsAlertState>;
  write(state: FailedJobsAlertState): Promise<void>;
}

export type FailedJobsWatchDeps = {
  /** The Failed jobs sources: background jobs and integration deliveries. */
  readonly sources: readonly IFailedJobNeedsReviewGroups[];
  readonly state: FailedJobsAlertStateStore;
  readonly alerts: AlertSink<FailedJobsAlertMessage>;
  readonly config: FailedJobsAlertConfig;
  readonly now: () => Date;
};

/** Where a group opens on Failed jobs: Needs review, filtered to its job type. */
export function failedJobsGroupPage(jobType: string): string {
  return `${FAILED_JOBS_PAGE}&queue=${encodeURIComponent(jobType)}`;
}

/** The alert's details: names, codes, counts and times only. */
export function alertDetails(alert: FailedJobsAlert): Record<string, unknown> {
  const listed = alert.groups.slice(0, MAX_LISTED_GROUPS);
  return {
    total: alert.total,
    totalNewInWindow: alert.totalNewInWindow,
    totalGrew: alert.totalGrew,
    groups: listed.map((group) => ({
      jobType: group.jobType,
      job: group.jobLabel,
      errorCode: group.errorCode,
      count: group.count,
      newInWindow: group.newInWindow,
      firstSeen: group.firstSeen.toISOString(),
      lastSeen: group.lastSeen.toISOString(),
      reasons: group.reasons,
      page: failedJobsGroupPage(group.jobType),
    })),
    moreGroups: alert.groups.length - listed.length,
    page: FAILED_JOBS_PAGE,
  };
}

/**
 * Reads Failed jobs (Needs review) from its sources once a day and raises one alert when a kind
 * of failure is new or growing, or Needs review as a whole is growing. Books documents are left
 * to the accounting watch, which alerts on them already.
 */
export class FailedJobsWatch {
  constructor(private readonly deps: FailedJobsWatchDeps) {}

  async check(): Promise<FailedJobsAlert | null> {
    const now = this.deps.now();
    const since = new Date(now.getTime() - this.deps.config.windowMs);
    const rows = (
      await Promise.all(this.deps.sources.map((source) => source.needsReviewGroups(since)))
    ).flat();
    const decision = decideFailedJobsAlert({
      groups: toFailedJobGroups(rows),
      state: await this.deps.state.read(),
      now,
      config: this.deps.config,
    });
    if (decision.alert) {
      this.deps.alerts.raise(FAILED_JOBS_ALERTS.growing, alertDetails(decision.alert));
    }
    await this.deps.state.write(decision.state);
    return decision.alert;
  }
}
