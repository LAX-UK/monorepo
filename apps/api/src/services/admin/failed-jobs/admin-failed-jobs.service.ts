import {
  FAILED_JOB_SOURCE_FAMILIES,
  FAILED_JOB_SOURCE_FAMILY_LABELS,
  type FailedJobBatchOutcome,
  type FailedJobBatchResult,
  type FailedJobDetail,
  type FailedJobDiscardReason,
  type FailedJobList,
  type FailedJobSourceFamily,
  type FailedJobSummary,
  type FailedJobView,
  failedJobSourcesFor,
} from "@auction/types";
import type { AdminFailedJobsQuery } from "@auction/validators";
import type { ActorContext } from "../../interfaces/queue-inspector.js";
import type { IFailedJobAuditTrail } from "./failed-job-audit-trail.js";
import type {
  FailedJobSourceAdapter,
  FailedJobViewer,
  ReviewTarget,
  SourceListQuery,
  SourceListResult,
} from "./sources/failed-job-source.js";

/** Errors a batch outcome can carry. The route shows these exactly, so keep them plain codes. */
export type FailedJobActionError =
  | "job_not_found"
  | "not_permitted"
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

/** Merging sources reads this many rows from each at most, so a deep page can't scan everything. */
const MERGE_WINDOW_MAX = 2000;

const EMPTY_COUNTS: Record<FailedJobView, number> = { needs_review: 0, retried: 0, discarded: 0 };

export type AdminFailedJobsDeps = {
  /** Where failures are read from, in the order they are offered. */
  sources: readonly FailedJobSourceAdapter[];
  audit: IFailedJobAuditTrail;
  /** The operator's kill switch for retries and discards. */
  actionsEnabled: boolean;
};

/**
 * Staff review of failures from every source: background jobs that ran out of attempts and
 * integration deliveries that never went through. It decides what each person may see and change
 * from the per-source access table, merges the sources into one list with shared views and
 * filters, and applies each decision (retry, discard, restore) job by job so one refusal never
 * blocks the rest. Every decision is checked against the job's state, then written to the audit
 * trail with the person who made it.
 */
export class AdminFailedJobsService {
  constructor(private readonly deps: AdminFailedJobsDeps) {}

  async list(query: AdminFailedJobsQuery, actor: ActorContext): Promise<FailedJobList> {
    const { actionsEnabled } = this.deps;
    const viewer = this.viewerFor(actor);
    const wanted = (adapter: FailedJobSourceAdapter) =>
      (!query.source || query.source === adapter.family) &&
      (!query.queue || adapter.ownsQueue(query.queue));
    const matching = this.deps.sources.filter(wanted);
    const window = Math.min(query.offset + query.limit, MERGE_WINDOW_MAX);

    const base: Omit<SourceListQuery, "limit" | "offset" | "queue"> = {
      view: query.view,
      sort: query.sort,
      viewer,
      actionsEnabled,
      ...(query.q ? { q: query.q } : {}),
      ...(query.from ? { fromDay: query.from } : {}),
      ...(query.to ? { toDay: query.to } : {}),
    };
    // A single source pages itself; several are merged from the top of each.
    const single = matching.length === 1;
    const results = await Promise.all(
      this.deps.sources.map((adapter) => {
        const filters = {
          ...base,
          ...(query.queue && adapter.ownsQueue(query.queue) ? { queue: query.queue } : {}),
        };
        // A source not asked for is still counted, so the Source filter shows its size.
        return wanted(adapter)
          ? adapter.list({
              ...filters,
              limit: single ? query.limit : window,
              offset: single ? query.offset : 0,
            })
          : adapter.list({ ...filters, limit: 0, offset: 0 });
      }),
    );

    const included = results.filter((_, index) => {
      const adapter = this.deps.sources[index];
      return adapter ? wanted(adapter) : false;
    });
    const rows = single
      ? (included[0]?.rows ?? [])
      : this.merge(included, query.sort).slice(query.offset, query.offset + query.limit);

    return {
      rows,
      total: sum(included.map((result) => result.total)),
      counts: included.reduce(
        (all, result) => ({
          needs_review: all.needs_review + result.counts.needs_review,
          retried: all.retried + result.counts.retried,
          discarded: all.discarded + result.counts.discarded,
        }),
        { ...EMPTY_COUNTS },
      ),
      queues: results
        .flatMap((result) => result.queues)
        .sort((a, b) => a.label.localeCompare(b.label)),
      sources: this.sourceFacets(results),
      canAct: viewer.act.size > 0,
      actionsEnabled,
    };
  }

  async detail(id: string, actor: ActorContext): Promise<FailedJobDetail | null> {
    const adapter = this.deps.sources.find((source) => source.owns(id));
    if (!adapter) return null;
    return adapter.detail(id, this.viewerFor(actor), this.deps.actionsEnabled, (auditId) =>
      this.deps.audit.history(auditId),
    );
  }

  async retry(
    ids: readonly string[],
    confirmRepeat: boolean,
    actor: ActorContext,
  ): Promise<FailedJobBatchResult> {
    return this.eachTarget(ids, actor, async (target) => {
      if (!target.retry.allowed) return this.refuseRetry(target);
      if (target.mayRepeat && !confirmRepeat) {
        return { id: target.id, ok: false, error: "repeat_not_confirmed" };
      }
      try {
        await target.retryNow(actor);
      } catch (error) {
        return { id: target.id, ok: false, error: this.retryError(error) };
      }
      await this.deps.audit.record({
        kind: "retried",
        jobId: target.auditId,
        actorUserId: actor.userId,
        payload: { ...target.auditFacts, confirmRepeat },
      });
      return { id: target.id, ok: true };
    });
  }

  async discard(
    ids: readonly string[],
    reason: FailedJobDiscardReason,
    note: string | undefined,
    actor: ActorContext,
  ): Promise<FailedJobBatchResult> {
    if (!this.deps.actionsEnabled) return this.allRefused(ids, "actions_disabled");
    return this.eachTarget(ids, actor, async (target) => {
      if (target.state !== "needs_review") {
        return { id: target.id, ok: false, error: this.stateError(target) };
      }
      const changed = await target.discard({
        byUserId: actor.userId,
        reason,
        note: note ?? null,
      });
      if (!changed) return { id: target.id, ok: false, error: "job_discarded" };
      await this.deps.audit.record({
        kind: "discarded",
        jobId: target.auditId,
        actorUserId: actor.userId,
        payload: { ...target.auditFacts, reason, ...(note ? { note } : {}) },
      });
      return { id: target.id, ok: true };
    });
  }

  async restore(ids: readonly string[], actor: ActorContext): Promise<FailedJobBatchResult> {
    if (!this.deps.actionsEnabled) return this.allRefused(ids, "actions_disabled");
    return this.eachTarget(ids, actor, async (target) => {
      if (target.state !== "discarded") {
        return { id: target.id, ok: false, error: "not_discarded" };
      }
      if (!(await target.restore())) return { id: target.id, ok: false, error: "not_discarded" };
      await this.deps.audit.record({
        kind: "restored",
        jobId: target.auditId,
        actorUserId: actor.userId,
        payload: target.auditFacts,
      });
      return { id: target.id, ok: true };
    });
  }

  /** What this person may see and change, from the per-source access table. */
  private viewerFor(actor: ActorContext): FailedJobViewer {
    return {
      read: new Set(failedJobSourcesFor(actor.staffRoles, "read")),
      act: new Set(failedJobSourcesFor(actor.staffRoles, "act")),
    };
  }

  /** Rows from several sources in the order asked: the sources are each sorted already. */
  private merge(results: readonly SourceListResult[], sort: "failed_desc" | "failed_asc") {
    const direction = sort === "failed_asc" ? 1 : -1;
    return results
      .flatMap((result) => result.rows)
      .sort(
        (a: FailedJobSummary, b: FailedJobSummary) =>
          direction * a.lastFailedAt.localeCompare(b.lastFailedAt) || a.id.localeCompare(b.id),
      );
  }

  /** The kinds of failure this person may see, each with the size of its current view. */
  private sourceFacets(results: readonly SourceListResult[]): FailedJobList["sources"] {
    return this.deps.sources
      .map((adapter, index) => ({ adapter, result: results[index] }))
      .filter(({ result }) => result?.readable)
      .map(({ adapter, result }) => ({
        id: adapter.family as FailedJobSourceFamily,
        label: FAILED_JOB_SOURCE_FAMILY_LABELS[adapter.family],
        count: result?.total ?? 0,
      }))
      .sort(
        (a, b) =>
          FAILED_JOB_SOURCE_FAMILIES.indexOf(a.id) - FAILED_JOB_SOURCE_FAMILIES.indexOf(b.id),
      );
  }

  /** Looks the targets up once per source, then runs `act` on each in the order asked. */
  private async eachTarget(
    ids: readonly string[],
    actor: ActorContext,
    act: (target: ReviewTarget) => Promise<FailedJobBatchOutcome>,
  ): Promise<FailedJobBatchResult> {
    const viewer = this.viewerFor(actor);
    const unique = [...new Set(ids)];
    const found = new Map<string, ReviewTarget>();
    for (const adapter of this.deps.sources) {
      const mine = unique.filter((id) => adapter.owns(id));
      if (mine.length === 0) continue;
      for (const target of await adapter.find(mine, this.deps.actionsEnabled)) {
        found.set(target.id, target);
      }
    }
    const results: FailedJobBatchOutcome[] = [];
    for (const id of unique) {
      const target = found.get(id);
      // A job in a source the person may not see is reported as missing, like any other.
      if (!target || !viewer.read.has(target.source)) {
        results.push({ id, ok: false, error: "job_not_found" });
      } else if (!viewer.act.has(target.source)) {
        results.push({ id, ok: false, error: "not_permitted" });
      } else {
        results.push(await act(target));
      }
    }
    return { results };
  }

  private allRefused(ids: readonly string[], error: FailedJobActionError): FailedJobBatchResult {
    return { results: [...new Set(ids)].map((id) => ({ id, ok: false, error })) };
  }

  private refuseRetry(target: ReviewTarget): FailedJobBatchOutcome {
    if (target.state !== "needs_review") {
      return { id: target.id, ok: false, error: this.stateError(target) };
    }
    return {
      id: target.id,
      ok: false,
      error: this.deps.actionsEnabled ? "retry_not_allowed" : "actions_disabled",
    };
  }

  private stateError(target: ReviewTarget): FailedJobActionError {
    return target.state === "discarded" ? "job_discarded" : "already_retried";
  }

  private retryError(error: unknown): FailedJobActionError {
    const message = error instanceof Error ? error.message : "";
    if (message === "already_replayed") return "already_retried";
    if (PASS_THROUGH_ERRORS.has(message)) return message as FailedJobActionError;
    return "retry_failed";
  }
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
