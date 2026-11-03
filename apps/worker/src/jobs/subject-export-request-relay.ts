import {
  IDENTITY_EVENT_TYPES,
  subjectDataExportRequestedPayloadSchemaV1,
} from "@auction/identity-contracts";
import {
  SUBJECT_DATA_EXPORT_JOB_NAMES,
  type SubjectDataExportJobPayload,
  subjectDataExportJobId,
} from "@auction/queues";
import type { JobsOptions } from "bullmq";
import type {
  IdentityOutboxRelayObserver,
  RelayedIdentityEvent,
} from "../interfaces/identity-outbox-relay.repository.js";

/** The one thing the relay needs from the queue. */
export interface SubjectDataExportQueueProducer {
  add(name: string, data: SubjectDataExportJobPayload, opts?: JobsOptions): Promise<unknown>;
}

/**
 * The jobs a batch of Identity events asks for: one per `subject.data_export_requested`, keyed by
 * the export id. An event whose payload does not match the contract is skipped (it carries no
 * export to build), and a repeated event maps to the same job id.
 */
export function subjectExportJobsFrom(
  events: readonly RelayedIdentityEvent[],
): SubjectDataExportJobPayload[] {
  const jobs = new Map<string, SubjectDataExportJobPayload>();
  for (const event of events) {
    if (event.eventType !== IDENTITY_EVENT_TYPES.DATA_EXPORT_REQUESTED) continue;
    const payload = subjectDataExportRequestedPayloadSchemaV1.safeParse(event.payload);
    if (!payload.success || payload.data.exportId !== event.aggregateId) continue;
    jobs.set(payload.data.exportId, {
      exportId: payload.data.exportId,
      subjectId: payload.data.subjectId,
    });
  }
  return [...jobs.values()];
}

/**
 * Relay observer that queues an assemble job for each data export request. The job id is the
 * export id, so the queue holds one job per request however often the event is relayed.
 */
export function createSubjectExportRequestRelay(
  queue: SubjectDataExportQueueProducer,
): IdentityOutboxRelayObserver {
  return async (events) => {
    for (const job of subjectExportJobsFrom(events)) {
      await queue.add(SUBJECT_DATA_EXPORT_JOB_NAMES.assemble, job, {
        jobId: subjectDataExportJobId(job.exportId),
      });
    }
  };
}
