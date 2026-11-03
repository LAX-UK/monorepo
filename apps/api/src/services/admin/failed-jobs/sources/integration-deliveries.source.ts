import type {
  IIntegrationDeadLetterDisposition,
  IIntegrationDeadLetterReader,
  IWebhookRetryQueue,
  IntegrationDeadLetterRecord,
} from "@auction/persistence/interfaces";
import type { IDomainEventDeliveryRepository } from "@auction/persistence/interfaces";
import { scrubErrorMessage, summariseError } from "@auction/queues";
import {
  type FailedJobDetail,
  type FailedJobRetryAvailability,
  type FailedJobState,
  type FailedJobSummary,
  isFailedJobDiscardReason,
} from "@auction/types";
import { isIntegrationScreenId } from "../failed-job-id.js";
import { discardReasonLabel } from "../failed-job-presenter.js";
import { maskIntegrationPayload } from "../integration-payload-mask.js";
import type {
  FailedJobSourceAdapter,
  FailedJobViewer,
  ReviewTarget,
  SourceListQuery,
  SourceListResult,
} from "./failed-job-source.js";
import { eventLabel } from "./integration-copy.js";
import {
  type IntegrationEndpoint,
  integrationEndpoint,
  integrationQueueId,
  integrationQueueLabel,
  knownIntegrationQueues,
  nameFilterFor,
  parseIntegrationQueueId,
} from "./integration-registry.js";

export type IntegrationDeliveriesSourceDeps = {
  reader: IIntegrationDeadLetterReader;
  disposition: IIntegrationDeadLetterDisposition;
  /** Puts a dead-lettered delivery back in flight with the same idempotency key. */
  deliveries: Pick<IDomainEventDeliveryRepository, "replay">;
  webhooks: IWebhookRetryQueue;
};

const EMPTY_COUNTS = { needs_review: 0, retried: 0, discarded: 0 } as const;

/** Which view a record is in: a decision wins, then whether it is failing now. */
export function integrationState(record: IntegrationDeadLetterRecord): FailedJobState {
  if (record.discardedAt) return "discarded";
  if (record.failing) return "needs_review";
  return "retried";
}

function retryAvailability(
  record: IntegrationDeadLetterRecord,
  actionsEnabled: boolean,
): FailedJobRetryAvailability {
  const state = integrationState(record);
  if (state === "retried") return { allowed: false, reason: "This has already been retried." };
  if (state === "discarded") {
    return { allowed: false, reason: "This was discarded. Restore it to retry it." };
  }
  if (!actionsEnabled) {
    return {
      allowed: false,
      reason: "Retries are switched off while an incident is handled.",
    };
  }
  return { allowed: true };
}

function numericId(record: IntegrationDeadLetterRecord): number {
  return Number(record.id.slice(record.id.indexOf(":") + 1));
}

/**
 * Integration deliveries that never went through: events Xero and Zoho gave up on, and inbound
 * webhooks that never processed. A retry puts the delivery back in flight with the same
 * idempotency key (Xero) or starts the webhook's handler again; both claim the retry first, so
 * two people pressing Retry run it once.
 */
export class IntegrationDeliveriesSource implements FailedJobSourceAdapter {
  readonly family = "integrations" as const;

  constructor(private readonly deps: IntegrationDeliveriesSourceDeps) {}

  owns(id: string): boolean {
    return isIntegrationScreenId(id);
  }

  ownsQueue(queue: string): boolean {
    return parseIntegrationQueueId(queue) !== null;
  }

  async list(query: SourceListQuery): Promise<SourceListResult> {
    const { viewer } = query;
    const scope = {
      deliveries: nameFilterFor("delivery", viewer.read),
      webhooks: nameFilterFor("webhook", viewer.read),
    };
    const nothingReadable = [scope.deliveries, scope.webhooks].every(
      (filter) => filter?.mode === "in" && filter.names.length === 0,
    );
    if (nothingReadable)
      return { readable: false, rows: [], total: 0, counts: { ...EMPTY_COUNTS }, queues: [] };

    const result = await this.deps.reader.search({
      view: query.view,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
      scope,
      ...(query.q ? { q: query.q } : {}),
      ...(query.queue ? { queue: query.queue } : {}),
      ...(query.fromDay ? { fromDay: query.fromDay } : {}),
      ...(query.toDay ? { toDay: query.toDay } : {}),
    });

    const counted = new Map(
      result.queues.map((entry) => [integrationQueueId(entry.kind, entry.name), entry.count]),
    );
    const known = knownIntegrationQueues().filter(({ kind, name }) =>
      viewer.read.has(integrationEndpoint(kind, name).scope),
    );
    const ids = new Set([
      ...counted.keys(),
      ...known.map(({ kind, name }) => integrationQueueId(kind, name)),
    ]);
    return {
      readable: true,
      rows: result.rows.map((record) => this.summary(record, viewer, query.actionsEnabled)),
      total: result.total,
      counts: result.counts,
      queues: [...ids].map((id) => {
        const parsed = parseIntegrationQueueId(id);
        return {
          id,
          label: parsed ? integrationQueueLabel(parsed.kind, parsed.name) : id,
          count: counted.get(id) ?? 0,
        };
      }),
    };
  }

  async detail(
    id: string,
    viewer: FailedJobViewer,
    actionsEnabled: boolean,
    history: (auditId: string) => Promise<FailedJobDetail["history"]>,
  ): Promise<FailedJobDetail | null> {
    const record = await this.deps.reader.findForReview(id);
    if (!record) return null;
    const endpoint = integrationEndpoint(record.kind, record.name);
    if (!viewer.read.has(endpoint.scope)) return null;
    const events = await history(record.id);
    const masked = maskIntegrationPayload(
      record.kind === "delivery" ? (record.eventType ?? "") : `webhook.${record.name}`,
      record.payload,
    );
    const discardedBy = events.find((event) => event.kind === "discarded")?.actorName ?? null;
    return {
      ...this.summary(record, viewer, actionsEnabled),
      retryEffect: endpoint.retryEffect,
      errorMessage: scrubErrorMessage(record.errorMessage),
      originalJobId: record.kind === "webhook" ? record.eventKey : String(numericId(record)),
      payload: masked.entries,
      omittedPayloadFields: masked.omitted,
      discard:
        record.discardedAt && record.discardReason
          ? {
              reasonLabel: isFailedJobDiscardReason(record.discardReason)
                ? discardReasonLabel(record.discardReason)
                : "Other",
              note: record.discardNote,
              at: record.discardedAt.toISOString(),
              byName: discardedBy,
            }
          : null,
      history: events,
    };
  }

  async find(ids: readonly string[], actionsEnabled: boolean): Promise<ReviewTarget[]> {
    const records = await this.deps.reader.findManyForReview(ids);
    return records.map((record) => this.target(record, actionsEnabled));
  }

  private summary(
    record: IntegrationDeadLetterRecord,
    viewer: FailedJobViewer,
    actionsEnabled: boolean,
  ): FailedJobSummary {
    const endpoint = integrationEndpoint(record.kind, record.name);
    return {
      id: record.id,
      source: endpoint.scope,
      canAct: viewer.act.has(endpoint.scope),
      queue: integrationQueueId(record.kind, record.name),
      typeLabel:
        record.kind === "delivery"
          ? `${eventLabel(record.eventType)} to ${endpoint.label}`
          : `${endpoint.label} webhook`,
      jobLabel: record.eventType,
      sourceLabel: `Integrations · ${endpoint.label}`,
      errorSummary: summariseError(record.errorMessage),
      attempts: record.attempts,
      firstFailedAt: record.firstFailedAt.toISOString(),
      lastFailedAt: record.failedAt.toISOString(),
      state: integrationState(record),
      mayRepeat: endpoint.mayRepeat,
      retry: retryAvailability(record, actionsEnabled),
    };
  }

  private target(record: IntegrationDeadLetterRecord, actionsEnabled: boolean): ReviewTarget {
    const endpoint: IntegrationEndpoint = integrationEndpoint(record.kind, record.name);
    const { disposition } = this.deps;
    const seed = {
      id: record.id,
      attempts: record.attempts,
      failedAt: record.failedAt,
      firstFailedAt: record.firstFailedAt,
    };
    return {
      id: record.id,
      source: endpoint.scope,
      state: integrationState(record),
      retry: retryAvailability(record, actionsEnabled),
      mayRepeat: endpoint.mayRepeat,
      auditId: record.id,
      auditFacts: {
        queue: integrationQueueId(record.kind, record.name),
        jobName: record.eventType,
      },
      retryNow: async (actor) => {
        if (!(await disposition.claimRetry(seed, actor.userId))) {
          throw new Error("already_replayed");
        }
        try {
          if (record.kind === "delivery") {
            await this.deps.deliveries.replay({ deliveryId: numericId(record) });
          } else if (record.eventKey) {
            await this.deps.webhooks.requeue(record.eventKey);
          }
        } catch (error) {
          await disposition.releaseRetry(record.id);
          throw error;
        }
      },
      discard: async ({ byUserId, reason, note }) =>
        (await disposition.discard({ seeds: [seed], byUserId, reason, note })).length > 0,
      restore: async () => (await disposition.restore([record.id])).length > 0,
    };
  }
}
