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
  isFailedJobDiscardReason,
} from "@auction/types";

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

export function toFailedJobSummary(
  record: FailedJobRecord,
  actionsEnabled: boolean,
): FailedJobSummary {
  const info = failedJobTypeInfo(record.originalQueue);
  return {
    id: record.id,
    queue: record.originalQueue,
    typeLabel: info.label,
    jobLabel: failedJobNameLabel(record.originalQueue, record.originalJobName),
    sourceLabel: info.sourceLabel,
    errorSummary: summariseError(record.errorMessage),
    attempts: record.attempts,
    firstFailedAt: record.firstFailedAt.toISOString(),
    lastFailedAt: record.failedAt.toISOString(),
    state: failedJobState(record),
    mayRepeat: info.mayRepeat,
    retry: failedJobRetry(record, actionsEnabled),
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
  actionsEnabled: boolean,
): FailedJobDetail {
  const masked = maskJobPayload(parsePayload(record.payloadJson));
  const discardedBy = history.find((event) => event.kind === "discarded")?.actorName ?? null;
  return {
    ...toFailedJobSummary(record, actionsEnabled),
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
          }
        : null,
    history,
  };
}
