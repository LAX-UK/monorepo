import type {
  FailedJobRecord,
  IFailedJobDisposition,
  IFailedJobReviewReader,
} from "@auction/persistence/interfaces";
import { failedJobTypeInfo, knownFailedJobQueues } from "@auction/queues";
import type { FailedJobDetail } from "@auction/types";
import type { IQueueMutator } from "../../../interfaces/queue-inspector.js";
import { backgroundJobStoreId, isBackgroundJobScreenId } from "../failed-job-id.js";
import {
  failedJobRetry,
  failedJobState,
  toFailedJobDetail,
  toFailedJobSummary,
} from "../failed-job-presenter.js";
import type {
  FailedJobSourceAdapter,
  FailedJobViewer,
  ReviewTarget,
  SourceListQuery,
  SourceListResult,
} from "./failed-job-source.js";

export type BackgroundJobsSourceDeps = {
  reader: IFailedJobReviewReader;
  disposition: IFailedJobDisposition;
  /** Retrying a failed job is a replay from the dead-letter record. */
  retrier: Pick<IQueueMutator, "replayFromDlq">;
};

const EMPTY_COUNTS = { needs_review: 0, retried: 0, discarded: 0 } as const;

/** Background jobs that ran out of attempts, read from the dead-letter record. */
export class BackgroundJobsSource implements FailedJobSourceAdapter {
  readonly family = "background_jobs" as const;

  constructor(private readonly deps: BackgroundJobsSourceDeps) {}

  owns(id: string): boolean {
    return isBackgroundJobScreenId(id);
  }

  ownsQueue(queue: string): boolean {
    return !queue.includes(":");
  }

  async list(query: SourceListQuery): Promise<SourceListResult> {
    if (!query.viewer.read.has("background_jobs")) {
      return { readable: false, rows: [], total: 0, counts: { ...EMPTY_COUNTS }, queues: [] };
    }
    const context = this.context(query.viewer, query.actionsEnabled);
    const result = await this.deps.reader.search({
      view: query.view,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
      ...(query.q ? { q: query.q } : {}),
      ...(query.queue ? { queue: query.queue } : {}),
      ...(query.fromDay ? { fromDay: query.fromDay } : {}),
      ...(query.toDay ? { toDay: query.toDay } : {}),
    });
    const counted = new Map(result.queues.map((entry) => [entry.queue, entry.count]));
    // Queues with failures first-class in the filter, then the ones that merely exist.
    const queueIds = new Set([
      ...counted.keys(),
      ...knownFailedJobQueues().map((queue) => queue.id),
    ]);
    return {
      readable: true,
      rows: result.rows.map((record) => toFailedJobSummary(record, context)),
      total: result.total,
      counts: result.counts,
      queues: [...queueIds].map((id) => ({
        id,
        label: failedJobTypeInfo(id).label,
        count: counted.get(id) ?? 0,
      })),
    };
  }

  async detail(
    id: string,
    viewer: FailedJobViewer,
    actionsEnabled: boolean,
    history: (auditId: string) => Promise<FailedJobDetail["history"]>,
  ): Promise<FailedJobDetail | null> {
    if (!viewer.read.has("background_jobs")) return null;
    const storeId = backgroundJobStoreId(id);
    const record = await this.deps.reader.findForReview(storeId);
    if (!record) return null;
    return toFailedJobDetail(record, await history(storeId), this.context(viewer, actionsEnabled));
  }

  async find(ids: readonly string[], actionsEnabled: boolean): Promise<ReviewTarget[]> {
    const wanted = new Map(ids.map((id) => [backgroundJobStoreId(id), id]));
    const records = await this.deps.reader.findManyForReview([...wanted.keys()]);
    return records.map((record) =>
      this.target(record, wanted.get(record.id) ?? record.id, actionsEnabled),
    );
  }

  private context(viewer: FailedJobViewer, actionsEnabled: boolean) {
    return { actionsEnabled, canAct: viewer.act.has("background_jobs") };
  }

  private target(record: FailedJobRecord, screenId: string, actionsEnabled: boolean): ReviewTarget {
    const { disposition, retrier } = this.deps;
    return {
      id: screenId,
      source: "background_jobs",
      state: failedJobState(record),
      retry: failedJobRetry(record, actionsEnabled),
      mayRepeat: failedJobTypeInfo(record.originalQueue).mayRepeat,
      auditId: record.id,
      auditFacts: { queue: record.originalQueue, jobName: record.originalJobName },
      retryNow: (actor) => retrier.replayFromDlq(record.id, actor, true),
      discard: async ({ byUserId, reason, note }) =>
        (await disposition.discard({ ids: [record.id], byUserId, reason, note })).length > 0,
      restore: async () => (await disposition.restore([record.id])).length > 0,
    };
  }
}
