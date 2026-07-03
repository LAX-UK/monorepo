import { toObjectRecord } from "@/lib/data/http/object-guards";
import { zCoerceDate } from "@/lib/data/http/schema-coerce";
import { z } from "zod";

export type AdminDomainEventRow = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  actingLegalEntityId: string | null;
  occurredAt: Date;
};

export const adminDomainEventRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): AdminDomainEventRow => ({
      id: String(row.id ?? ""),
      aggregateType: String(row.aggregateType ?? ""),
      aggregateId: String(row.aggregateId ?? ""),
      eventType: String(row.eventType ?? ""),
      payload: (row.payload as Record<string, unknown>) ?? {},
      actorUserId: row.actorUserId == null ? null : String(row.actorUserId),
      actingLegalEntityId: row.actingLegalEntityId == null ? null : String(row.actingLegalEntityId),
      occurredAt: zCoerceDate.parse(row.occurredAt ?? ""),
    }),
  ) as z.ZodType<AdminDomainEventRow>;
