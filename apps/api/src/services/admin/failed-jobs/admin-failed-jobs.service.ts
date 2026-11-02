import type {
  FailedJobRecord,
  IFailedJobDisposition,
  IFailedJobReviewReader,
} from "@auction/persistence/interfaces";
import { failedJobTypeInfo, knownFailedJobQueues } from "@auction/queues";
import type {
  FailedJobBatchOutcome,
  FailedJobBatchResult,
  FailedJobDetail,
  FailedJobDiscardReason,
  FailedJobList,
} from "@auction/types";
import type { AdminFailedJobsQuery } from "@auction/validators";
import type { ActorContext, IQueueMutator } from "../../interfaces/queue-inspector.js";
import type { IFailedJobAuditTrail } from "./failed-job-audit-trail.js";
import {
  failedJobRetry,
  failedJobState,
  toFailedJobDetail,
  toFailedJobSummary,
} from "./failed-job-presenter.js";

/** Errors a batch outcome can carry. The route shows these exactly, so keep them plain codes. */
export type FailedJobActionError =
  | "job_not_found"
  | "actions_disabled"
  | "retry_not_allowed"
  | "already_retried"
  | "job_discarded"
  | "repeat_not_confirmed"
  | "not_discarded"
  | "retry_failed"
  | "rate_limit_exceeded"
  | "payload_not_available";

const PASS_THROUGH_ERRORS: ReadonlySet<string> = new Set([
  "rate_limit_exceeded",
  "already_replayed",
  "payload_not_available",
]);

export type AdminFailedJobsDeps = {
  reader: IFailedJobReviewReader;
  disposition: IFailedJobDisposition;
  /** Retrying a failed job is a replay from the dead-letter record. */
  retrier: Pick<IQueueMutator, "replayFromDlq">;
  audit: IFailedJobAuditTrail;
  /** The operator's kill switch for retries and discards. */
  actionsEnabled: boolean;
};

/**
 * Staff review of background jobs that ran out of attempts: the list with its views and filters,
 * one job with a masked payload and its history, and the decisions to retry, discard or restore.
 * Each decision is checked against the job's state and type, applied job by job so one refusal
 * never blocks the rest, and written to the audit trail with the person who made it.
 */
export class AdminFailedJobsService {
  constructor(private readonly deps: AdminFailedJobsDeps) {}

  async list(query: AdminFailedJobsQuery): Promise<FailedJobList> {
    const { actionsEnabled } = this.deps;
    const result = await this.deps.reader.search({
      view: query.view,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
      ...(query.q ? { q: query.q } : {}),
      ...(query.queue ? { queue: query.queue } : {}),
      ...(query.from ? { fromDay: query.from } : {}),
      ...(query.to ? { toDay: query.to } : {}),
    });
    const counted = new Map(result.queues.map((entry) => [entry.queue, entry.count]));
    // Queues with failures first-class in the filter, then the ones that merely exist.
    const known = knownFailedJobQueues();
    const queueIds = new Set([...counted.keys(), ...known.map((queue) => queue.id)]);
    return {
      rows: result.rows.map((record) => toFailedJobSummary(record, actionsEnabled)),
      total: result.total,
      counts: result.counts,
      queues: [...queueIds]
        .map((id) => ({
          id,
          label: failedJobTypeInfo(id).label,
          count: counted.get(id) ?? 0,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      actionsEnabled,
    };
  }

  async detail(id: string): Promise<FailedJobDetail | null> {
    const record = await this.deps.reader.findForReview(id);
    if (!record) return null;
    const history = await this.deps.audit.history(id);
    return toFailedJobDetail(record, history, this.deps.actionsEnabled);
  }

  async retry(
    ids: readonly string[],
    confirmRepeat: boolean,
    actor: ActorContext,
  ): Promise<FailedJobBatchResult> {
    return this.eachJob(ids, async (record) => {
      const availability = failedJobRetry(record, this.deps.actionsEnabled);
      if (!availability.allowed) return this.refuseRetry(record);
      if (failedJobTypeInfo(record.originalQueue).mayRepeat && !confirmRepeat) {
        return { id: record.id, ok: false, error: "repeat_not_confirmed" };
      }
      try {
        await this.deps.retrier.replayFromDlq(record.id, actor, true);
      } catch (error) {
        return { id: record.id, ok: false, error: this.retryError(error) };
      }
      await this.deps.audit.record({
        kind: "retried",
        jobId: record.id,
        actorUserId: actor.userId,
        payload: {
          queue: record.originalQueue,
          jobName: record.originalJobName,
          confirmRepeat,
        },
      });
      return { id: record.id, ok: true };
    });
  }

  async discard(
    ids: readonly string[],
    reason: FailedJobDiscardReason,
    note: string | undefined,
    actor: ActorContext,
  ): Promise<FailedJobBatchResult> {
    if (!this.deps.actionsEnabled) return this.allRefused(ids, "actions_disabled");
    return this.eachJob(ids, async (record) => {
      if (failedJobState(record) !== "needs_review") {
        return { id: record.id, ok: false, error: this.stateError(record) };
      }
      const changed = await this.deps.disposition.discard({
        ids: [record.id],
        byUserId: actor.userId,
        reason,
        note: note ?? null,
      });
      if (changed.length === 0) return { id: record.id, ok: false, error: "job_discarded" };
      await this.deps.audit.record({
        kind: "discarded",
        jobId: record.id,
        actorUserId: actor.userId,
        payload: {
          queue: record.originalQueue,
          jobName: record.originalJobName,
          reason,
          ...(note ? { note } : {}),
        },
      });
      return { id: record.id, ok: true };
    });
  }

  async restore(ids: readonly string[], actor: ActorContext): Promise<FailedJobBatchResult> {
    if (!this.deps.actionsEnabled) return this.allRefused(ids, "actions_disabled");
    return this.eachJob(ids, async (record) => {
      if (failedJobState(record) !== "discarded") {
        return { id: record.id, ok: false, error: "not_discarded" };
      }
      const changed = await this.deps.disposition.restore([record.id]);
      if (changed.length === 0) return { id: record.id, ok: false, error: "not_discarded" };
      await this.deps.audit.record({
        kind: "restored",
        jobId: record.id,
        actorUserId: actor.userId,
        payload: { queue: record.originalQueue, jobName: record.originalJobName },
      });
      return { id: record.id, ok: true };
    });
  }

  /** Looks the jobs up once, then runs `act` on each in the order asked, reporting every outcome. */
  private async eachJob(
    ids: readonly string[],
    act: (record: FailedJobRecord) => Promise<FailedJobBatchOutcome>,
  ): Promise<FailedJobBatchResult> {
    const unique = [...new Set(ids)];
    const found = new Map(
      (await this.deps.reader.findManyForReview(unique)).map((record) => [record.id, record]),
    );
    const results: FailedJobBatchOutcome[] = [];
    for (const id of unique) {
      const record = found.get(id);
      results.push(record ? await act(record) : { id, ok: false, error: "job_not_found" });
    }
    return { results };
  }

  private allRefused(ids: readonly string[], error: FailedJobActionError): FailedJobBatchResult {
    return { results: [...new Set(ids)].map((id) => ({ id, ok: false, error })) };
  }

  private refuseRetry(record: FailedJobRecord): FailedJobBatchOutcome {
    const state = failedJobState(record);
    if (state !== "needs_review")
      return { id: record.id, ok: false, error: this.stateError(record) };
    return {
      id: record.id,
      ok: false,
      error: this.deps.actionsEnabled ? "retry_not_allowed" : "actions_disabled",
    };
  }

  private stateError(record: FailedJobRecord): FailedJobActionError {
    return failedJobState(record) === "discarded" ? "job_discarded" : "already_retried";
  }

  private retryError(error: unknown): FailedJobActionError {
    const message = error instanceof Error ? error.message : "";
    if (message === "already_replayed") return "already_retried";
    if (PASS_THROUGH_ERRORS.has(message)) return message as FailedJobActionError;
    return "retry_failed";
  }
}
