import type { AuditLogRecord, IAdminDomainEventReader } from "@auction/persistence/interfaces";
import {
  AUDIT_LOG_VIEW_PREFIXES,
  redactDomainEventPayload,
  scrubPayloadSecrets,
} from "@auction/types";
import type {
  AdminAuditActor,
  AdminAuditActorOption,
  AdminAuditLogEntry,
  AdminAuditLogSearch,
  IAdminAuditLogService,
} from "../interfaces/admin-routes/admin-operations-routes.js";

/**
 * What the caller may see of one event: the payload is minimised for them and stripped of
 * credentials whatever their access, and a client's identity is shown only to callers who may
 * read PII. Staff actors are accountable for what they do, so they are always named.
 */
export function toAuditLogEntry(record: AuditLogRecord, includePii: boolean): AdminAuditLogEntry {
  const actor: AdminAuditActor | null = record.actorUserId
    ? record.actorIsStaff || includePii
      ? {
          kind: record.actorIsStaff ? "staff" : "client",
          name: record.actorName,
          email: record.actorEmail,
        }
      : { kind: "client", name: null, email: null }
    : null;
  return {
    id: String(record.id),
    aggregateType: record.aggregateType,
    aggregateId: record.aggregateId,
    eventType: record.eventType,
    payload: scrubPayloadSecrets(
      redactDomainEventPayload(record.eventType, record.payload, { includePii }),
    ),
    actorUserId: record.actorUserId,
    actor,
    actingLegalEntityId: record.actingLegalEntityId,
    occurredAt: record.occurredAt,
  };
}

export class AdminAuditLogService implements IAdminAuditLogService {
  constructor(private readonly reader: IAdminDomainEventReader) {}

  async search(input: AdminAuditLogSearch): Promise<{ rows: AdminAuditLogEntry[]; total: number }> {
    const { rows, total } = await this.reader.searchAuditLog({
      limit: input.limit,
      offset: input.offset,
      matchClientActors: input.includePii,
      ...(input.q ? { q: input.q } : {}),
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(input.eventTypes?.length ? { eventTypes: input.eventTypes } : {}),
      ...(input.view ? { eventTypePrefixes: AUDIT_LOG_VIEW_PREFIXES[input.view] } : {}),
      ...(input.aggregateType ? { aggregateType: input.aggregateType } : {}),
      ...(input.aggregateId ? { aggregateId: input.aggregateId } : {}),
      ...(input.fromDay ? { fromDay: input.fromDay } : {}),
      ...(input.toDay ? { toDay: input.toDay } : {}),
    });
    return { rows: rows.map((row) => toAuditLogEntry(row, input.includePii)), total };
  }

  async searchActors(input: {
    q?: string;
    limit: number;
    includePii: boolean;
  }): Promise<AdminAuditActorOption[]> {
    const actors = await this.reader.searchAuditActors({
      limit: input.limit,
      staffOnly: !input.includePii,
      ...(input.q ? { q: input.q } : {}),
    });
    return actors.map(({ userId, name, email }) => ({ userId, name, email }));
  }
}
