import type { TimelineEvent } from "@auction/staff-ui";
import type { FailedJobDetail } from "@auction/types";

const HISTORY_TITLE = {
  retried: { title: "Retry started", tone: "info" },
  discarded: { title: "Discarded", tone: "neutral" },
  restored: { title: "Restored to review", tone: "neutral" },
} as const satisfies Record<string, { title: string; tone: TimelineEvent["tone"] }>;

/** A second between two failures is the same failure written twice. */
const SAME_FAILURE_MS = 1_000;

/**
 * One job's history, newest first: every decision with the person and reason, then the failures
 * that brought it here. Decisions come from the audit trail, failures from the job itself.
 */
export function failedJobTimeline(job: FailedJobDetail): TimelineEvent[] {
  const decisions: TimelineEvent[] = job.history.map((event) => ({
    id: event.id,
    title: HISTORY_TITLE[event.kind].title,
    tone: HISTORY_TITLE[event.kind].tone,
    at: event.at,
    actor: event.actorName ?? "A team member",
    ...(event.detail ? { detail: event.detail } : {}),
  }));
  const failures: TimelineEvent[] = [
    {
      id: "first-failure",
      title:
        job.attempts === 1
          ? "Failed on its only attempt"
          : `Ran out of attempts after ${job.attempts} tries`,
      tone: "danger",
      at: job.firstFailedAt,
      actor: "System",
      detail: job.errorSummary,
    },
  ];
  if (Date.parse(job.lastFailedAt) - Date.parse(job.firstFailedAt) > SAME_FAILURE_MS) {
    failures.push({
      id: "last-failure",
      title: "Failed again",
      tone: "danger",
      at: job.lastFailedAt,
      actor: "System",
    });
  }
  return [...decisions, ...failures].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
