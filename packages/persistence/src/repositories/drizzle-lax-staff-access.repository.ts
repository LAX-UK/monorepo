import type { Database } from "@auction/db";
import { domainEvent, laxStaffAccessDirectory } from "@auction/db/schema";
import {
  type LaxStaffAccessGrantedPayloadV1,
  type LaxStaffAccessRevokedPayloadV1,
  laxStaffAccessGrantedPayloadSchemaV1,
  laxStaffAccessRevokedPayloadSchemaV1,
} from "@auction/types";
import { and, desc, eq, inArray } from "drizzle-orm";
import type {
  ILaxStaffAccessRepository,
  LaxStaffAccessEntry,
  LaxStaffAccessHistoryEntry,
  LaxStaffAccessRequest,
} from "../interfaces/lax-staff-access.repository.js";

const GRANTED = "lax.staff_access.granted";
const REVOKED = "lax.staff_access.revoked";

export type LaxStaffAccessEvent =
  | { type: typeof GRANTED; payload: LaxStaffAccessGrantedPayloadV1 }
  | { type: typeof REVOKED; payload: LaxStaffAccessRevokedPayloadV1 };

/** Inserts staff access events inside the caller's transaction (aggregate = subject). */
export async function insertLaxStaffAccessEvents(
  db: Database,
  producer: string,
  events: readonly LaxStaffAccessEvent[],
): Promise<void> {
  if (events.length === 0) return;
  await db.insert(domainEvent).values(
    events.map((event) => ({
      aggregateType: "user",
      aggregateId: event.payload.subjectId,
      eventType: event.type,
      producer,
      payload: event.payload,
      actorUserId:
        event.type === GRANTED
          ? event.payload.grantedBySubjectId
          : event.payload.revokedBySubjectId,
      schemaVersion: 1,
    })),
  );
}

export class DrizzleLaxStaffAccessRepository implements ILaxStaffAccessRepository {
  constructor(
    private readonly db: Database,
    private readonly producer = "apps/api",
  ) {}

  async listForSubjects(subjectIds: readonly string[]): Promise<LaxStaffAccessEntry[]> {
    if (subjectIds.length === 0) return [];
    return this.db
      .select()
      .from(laxStaffAccessDirectory)
      .where(inArray(laxStaffAccessDirectory.subjectId, [...new Set(subjectIds)]));
  }

  async history(subjectId: string, limit: number): Promise<LaxStaffAccessHistoryEntry[]> {
    const rows = await this.db
      .select({
        id: domainEvent.id,
        eventType: domainEvent.eventType,
        payload: domainEvent.payload,
        occurredAt: domainEvent.occurredAt,
      })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, "user"),
          eq(domainEvent.aggregateId, subjectId),
          inArray(domainEvent.eventType, [GRANTED, REVOKED]),
        ),
      )
      .orderBy(desc(domainEvent.occurredAt), desc(domainEvent.id))
      .limit(limit);
    return rows.flatMap((row): LaxStaffAccessHistoryEntry[] => {
      if (row.eventType === GRANTED) {
        const parsed = laxStaffAccessGrantedPayloadSchemaV1.safeParse(row.payload);
        if (!parsed.success) return [];
        return [
          {
            eventId: row.id,
            at: row.occurredAt,
            product: parsed.data.product,
            action: "granted",
            role: parsed.data.role,
            actorSubjectId: parsed.data.grantedBySubjectId,
            invitationId: parsed.data.invitationId,
          },
        ];
      }
      const parsed = laxStaffAccessRevokedPayloadSchemaV1.safeParse(row.payload);
      if (!parsed.success) return [];
      return [
        {
          eventId: row.id,
          at: row.occurredAt,
          product: parsed.data.product,
          action: "revoked",
          role: null,
          actorSubjectId: parsed.data.revokedBySubjectId,
          invitationId: null,
        },
      ];
    });
  }

  async requestGrant(input: LaxStaffAccessRequest & { role: string }): Promise<void> {
    await insertLaxStaffAccessEvents(this.db, this.producer, [
      {
        type: GRANTED,
        payload: {
          schemaVersion: 1,
          subjectId: input.subjectId,
          product: input.product,
          role: input.role,
          grantedBySubjectId: input.actorSubjectId,
          invitationId: null,
        },
      },
    ]);
  }

  async requestRevoke(input: LaxStaffAccessRequest): Promise<void> {
    await insertLaxStaffAccessEvents(this.db, this.producer, [
      {
        type: REVOKED,
        payload: {
          schemaVersion: 1,
          subjectId: input.subjectId,
          product: input.product,
          revokedBySubjectId: input.actorSubjectId,
        },
      },
    ]);
  }
}
