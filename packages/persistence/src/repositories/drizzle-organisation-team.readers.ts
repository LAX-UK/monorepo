import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  domainEvent,
  legalEntityInvoiceDetails,
  legalEntityMember,
} from "@auction/db/schema";
import type { ActivityEventRecord } from "@auction/domain";
import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import type {
  ActivityListFilter,
  ActivityPerson,
  IInvoiceDetailsRepository,
  IOrganisationActivityReader,
  InvoiceDetails,
} from "../interfaces/organisation-team.readers.js";

type InvoiceRow = typeof legalEntityInvoiceDetails.$inferSelect;

function toInvoiceDetails(row: InvoiceRow): InvoiceDetails {
  const { line1, city, postalCode, country } = row;
  return {
    billingEmail: row.billingEmail,
    address:
      line1 && city && postalCode && country
        ? { line1, line2: row.line2, city, region: row.region, postalCode, country }
        : null,
    poReference: row.poReference,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleInvoiceDetailsRepository implements IInvoiceDetailsRepository {
  constructor(private readonly db: Database) {}

  async find(legalEntityId: string): Promise<InvoiceDetails | null> {
    const [row] = await this.db
      .select()
      .from(legalEntityInvoiceDetails)
      .where(eq(legalEntityInvoiceDetails.legalEntityId, legalEntityId))
      .limit(1);
    return row ? toInvoiceDetails(row) : null;
  }

  async save(
    legalEntityId: string,
    details: Omit<InvoiceDetails, "updatedAt">,
    updatedByUserId: string,
  ): Promise<InvoiceDetails> {
    const address = details.address;
    const values = {
      billingEmail: details.billingEmail,
      line1: address?.line1 ?? null,
      line2: address?.line2 ?? null,
      city: address?.city ?? null,
      region: address?.region ?? null,
      postalCode: address?.postalCode ?? null,
      country: address?.country ?? null,
      poReference: details.poReference,
      updatedByUserId,
      updatedAt: new Date(),
    };
    const [row] = await this.db
      .insert(legalEntityInvoiceDetails)
      .values({ legalEntityId, ...values })
      .onConflictDoUpdate({ target: legalEntityInvoiceDetails.legalEntityId, set: values })
      .returning();
    if (!row) throw new Error("invoice_details_not_saved");
    return toInvoiceDetails(row);
  }
}

/** Payload fields that name the member an entry is about (see the domain's Activity table). */
const SUBJECT_KEYS = ["member_user_id", "invitee_user_id"] as const;

/**
 * Reads Activity over `domain_events`: events recorded while acting for the organisation
 * (`domain_events_acting_legal_entity_idx`) or about it as an aggregate
 * (`domain_events_aggregate_idx`), newest first, paged by id.
 */
export class DrizzleOrganisationActivityReader implements IOrganisationActivityReader {
  constructor(private readonly db: Database) {}

  async list(filter: ActivityListFilter): Promise<ActivityEventRecord[]> {
    if (filter.eventTypes.length === 0) return [];
    const person = filter.personUserId;
    const rows = await this.db
      .select({
        id: domainEvent.id,
        eventType: domainEvent.eventType,
        occurredAt: domainEvent.occurredAt,
        actorUserId: domainEvent.actorUserId,
        payload: domainEvent.payload,
      })
      .from(domainEvent)
      .where(
        and(
          or(
            eq(domainEvent.actingLegalEntityId, filter.legalEntityId),
            and(
              eq(domainEvent.aggregateType, "legal_entity"),
              eq(domainEvent.aggregateId, filter.legalEntityId),
            ),
          ),
          inArray(domainEvent.eventType, [...filter.eventTypes]),
          gte(domainEvent.occurredAt, filter.since),
          lt(domainEvent.occurredAt, filter.until),
          filter.beforeId ? lt(domainEvent.id, filter.beforeId) : undefined,
          person
            ? or(
                eq(domainEvent.actorUserId, person),
                ...SUBJECT_KEYS.map((key) => sql`${domainEvent.payload}->>${key} = ${person}`),
              )
            : undefined,
        ),
      )
      .orderBy(desc(domainEvent.id))
      .limit(filter.limit);
    return rows;
  }

  async people(
    legalEntityId: string,
    userIds: readonly string[],
  ): Promise<Map<string, ActivityPerson>> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({
        userId: bidIdentityDirectory.subjectId,
        name: bidIdentityDirectory.name,
        memberships: sql<number>`(
          select count(*)::int from ${legalEntityMember}
          where ${legalEntityMember.legalEntityId} = ${legalEntityId}
            and ${legalEntityMember.userId} = ${bidIdentityDirectory.subjectId}
        )`,
      })
      .from(bidIdentityDirectory)
      .where(inArray(bidIdentityDirectory.subjectId, ids));
    return new Map(
      rows.map((row) => [row.userId, { name: row.name, wasMember: Number(row.memberships) > 0 }]),
    );
  }
}
