import type { IAdminDomainEventReader } from "@auction/persistence/interfaces";
import type { FailedJobHistoryEvent } from "@auction/types";
import type { IDomainEventSink } from "../../domain-event-sink.js";
import { discardReasonLabel } from "./failed-job-presenter.js";

export const FAILED_JOB_AGGREGATE = "failed_job";

export type FailedJobAuditKind = FailedJobHistoryEvent["kind"];

const EVENT_TYPE_BY_KIND: Readonly<Record<FailedJobAuditKind, string>> = {
  retried: "failed_job.retried",
  discarded: "failed_job.discarded",
  restored: "failed_job.restored",
};

const KIND_BY_EVENT_TYPE = new Map(
  Object.entries(EVENT_TYPE_BY_KIND).map(([kind, type]) => [type, kind as FailedJobAuditKind]),
);

/** The part of the audit trail the failed jobs service needs: write a decision, read a job's. */
export interface IFailedJobAuditTrail {
  record(input: {
    kind: FailedJobAuditKind;
    jobId: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
  history(jobId: string): Promise<FailedJobHistoryEvent[]>;
}

const HISTORY_LIMIT = 100;

/** Writes decisions as domain events, so they appear in the staff audit log with their actor. */
export class DomainEventFailedJobAuditTrail implements IFailedJobAuditTrail {
  constructor(
    private readonly sink: IDomainEventSink,
    private readonly reader: Pick<IAdminDomainEventReader, "searchAuditLog">,
  ) {}

  async record(input: {
    kind: FailedJobAuditKind;
    jobId: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.sink.publish({
      aggregateType: FAILED_JOB_AGGREGATE,
      aggregateId: input.jobId,
      eventType: EVENT_TYPE_BY_KIND[input.kind],
      payload: input.payload,
      producer: "apps/api",
      actorUserId: input.actorUserId,
    });
  }

  async history(jobId: string): Promise<FailedJobHistoryEvent[]> {
    const { rows } = await this.reader.searchAuditLog({
      limit: HISTORY_LIMIT,
      offset: 0,
      sort: "at_asc",
      matchClientActors: false,
      aggregateType: FAILED_JOB_AGGREGATE,
      aggregateId: jobId,
    });
    const events: FailedJobHistoryEvent[] = [];
    for (const row of rows) {
      const kind = KIND_BY_EVENT_TYPE.get(row.eventType);
      if (!kind) continue;
      events.push({
        id: String(row.id),
        kind,
        at: new Date(row.occurredAt).toISOString(),
        actorName: row.actorName ?? null,
        detail: historyDetail(kind, row.payload),
      });
    }
    return events;
  }
}

function historyDetail(kind: FailedJobAuditKind, payload: unknown): string | null {
  if (kind !== "discarded" || payload === null || typeof payload !== "object") return null;
  const { reason, note } = payload as { reason?: unknown; note?: unknown };
  if (typeof reason !== "string") return null;
  const label = discardReasonLabel(reason);
  return typeof note === "string" && note.trim() ? `${label}: ${note.trim()}` : label;
}
