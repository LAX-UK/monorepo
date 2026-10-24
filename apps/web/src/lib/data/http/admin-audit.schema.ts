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

/** Who did it, as far as the viewer may see: client identities are hidden without PII access. */
export type AdminAuditActor = {
  kind: "staff" | "client";
  name: string | null;
  email: string | null;
};

/** One event of the staff audit log: the domain event plus its actor. */
export type AdminAuditLogRow = AdminDomainEventRow & { actor: AdminAuditActor | null };

function parseActor(value: unknown): AdminAuditActor | null {
  const record = toObjectRecord(value);
  if (Object.keys(record).length === 0) return null;
  return {
    kind: record.kind === "staff" ? "staff" : "client",
    name: typeof record.name === "string" ? record.name : null,
    email: typeof record.email === "string" ? record.email : null,
  };
}

export const adminAuditLogRowSchema = z.preprocess(toObjectRecord, z.record(z.unknown())).transform(
  (row): AdminAuditLogRow => ({
    ...adminDomainEventRowSchema.parse(row),
    actor: parseActor(row.actor),
  }),
) as z.ZodType<AdminAuditLogRow>;

export type AdminAuditActorOption = { userId: string; name: string; email: string };

export const adminAuditActorOptionSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): AdminAuditActorOption => ({
      userId: String(row.userId ?? ""),
      name: String(row.name ?? ""),
      email: String(row.email ?? ""),
    }),
  ) as z.ZodType<AdminAuditActorOption>;
