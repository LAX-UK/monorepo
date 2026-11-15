import type { FailedJobRecord, FailedJobRecordWithPayload } from "@auction/persistence/interfaces";
import {
  failedJobNameLabel,
  failedJobTypeInfo,
  maskJobPayload,
  retryAvailability,
  scrubErrorMessage,
  summariseError,
} from "@auction/queues";
import {
  FAILED_JOB_DISCARD_REASON_OPTIONS,
  type FailedJobDetail,
  type FailedJobHistoryEvent,
  type FailedJobRetryAvailability,
  type FailedJobState,
  type FailedJobSummary,
  failedJobRestorableUntil,
  isFailedJobDiscardReason,
} from "@auction/types";
import { backgroundJobScreenId } from "./failed-job-id.js";

export function failedJobState(record: FailedJobRecord): FailedJobState {
  if (record.discardedAt) return "discarded";
  if (record.replayedAt) return "retried";
  return "needs_review";
}

/** Whether a retry is offered now: the job's state first, then the type and the kill switch. */
export function failedJobRetry(
  record: FailedJobRecord,
  actionsEnabled: boolean,
): FailedJobRetryAvailability {
  const state = failedJobState(record);
  if (state === "retried") return { allowed: false, reason: "This job has already been retried." };
  if (state === "discarded") {
    return { allowed: false, reason: "This job was discarded. Restore it to retry it." };
  }
  return retryAvailability(record.originalQueue, { actionsEnabled });
}

/** What the viewer's rights and the operator's switch add to a row. */
export type SummaryContext = { actionsEnabled: boolean; canAct: boolean };

export function toFailedJobSummary(
  record: FailedJobRecord,
  context: SummaryContext,
): FailedJobSummary {
  const info = failedJobTypeInfo(record.originalQueue);
  return {
    id: backgroundJobScreenId(record.id),
    source: "background_jobs",
    canAct: context.canAct,
    queue: record.originalQueue,
    typeLabel: info.label,
    jobLabel: failedJobNameLabel(record.originalQueue, record.originalJobName),
    sourceLabel: info.sourceLabel,
    errorSummary: summariseError(record.errorMessage),
    groupSize: 1,
    groupCapped: false,
    attempts: record.attempts,
    firstFailedAt: record.firstFailedAt.toISOString(),
    lastFailedAt: record.failedAt.toISOString(),
    state: failedJobState(record),
    mayRepeat: info.mayRepeat,
    retry: failedJobRetry(record, context.actionsEnabled),
  };
}

function parsePayload(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

export function discardReasonLabel(reason: string): string {
  return isFailedJobDiscardReason(reason)
    ? FAILED_JOB_DISCARD_REASON_OPTIONS[reason].label
    : "Other";
}

export function toFailedJobDetail(
  record: FailedJobRecordWithPayload,
  history: FailedJobHistoryEvent[],
  context: SummaryContext,
): FailedJobDetail {
  const masked = maskJobPayload(parsePayload(record.payloadJson));
  const discardedBy = history.find((event) => event.kind === "discarded")?.actorName ?? null;
  return {
    ...toFailedJobSummary(record, context),
    retryEffect: failedJobTypeInfo(record.originalQueue).retryEffect,
    errorMessage: scrubErrorMessage(record.errorMessage),
    originalJobId: record.originalJobId,
    payload: masked.entries,
    omittedPayloadFields: masked.omitted,
    discard:
      record.discardedAt && record.discardReason
        ? {
            reasonLabel: discardReasonLabel(record.discardReason),
            note: record.discardNote,
            at: record.discardedAt.toISOString(),
            byName: discardedBy,
            restorableUntil: failedJobRestorableUntil(record.discardedAt),
          }
        : null,
    history,
  };
}

/** Failures that read the same, as the store counts them (error line not yet summarised). */
export type FailureGroupCount = {
  queue: string;
  jobLabel: string | null;
  errorLine: string;
  count: number;
};

const groupKey = (queue: string, jobLabel: string | null, errorSummary: string) =>
  [queue, jobLabel ?? "", errorSummary].join("\u0000");

/** How complete the group counts of a search are. */
export type FailureGroupCoverage = {
  /** The cap cut the tail of the groups, or counting was skipped. */
  partial: boolean;
  /** No group counts were computed at all. */
  skipped: boolean;
};

/**
 * Sets each row's `groupSize` to how many failures across every page read the same as it does.
 * Groups are matched the way the screen groups rows (job type, job and summarised error), so two
 * stored errors that summarise alike count together. When the counts are partial, a row whose
 * group is missing is marked `groupCapped` (its size is a lower bound, never shown as exact).
 */
export function withGroupSizes(
  rows: readonly FailedJobSummary[],
  groups: readonly FailureGroupCount[],
  coverage: FailureGroupCoverage = { partial: false, skipped: false },
): FailedJobSummary[] {
  const sizes = new Map<string, number>();
  for (const group of groups) {
    const key = groupKey(group.queue, group.jobLabel, summariseError(group.errorLine));
    sizes.set(key, (sizes.get(key) ?? 0) + group.count);
  }
  return rows.map((row) => {
    const size = coverage.skipped
      ? undefined
      : sizes.get(groupKey(row.queue, row.jobLabel, row.errorSummary));
    return {
      ...row,
      groupSize: Math.max(1, size ?? 1),
      groupCapped: size === undefined && coverage.partial,
    };
  });
}
