import { bidIdentityDirectory, bidUserProfile, domainEvent } from "@auction/db/schema";
import { type SQL, and, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import type { AuditLogSearchInput } from "../interfaces/admin-read-models.js";
import { escapeLikePattern } from "../lib/like-pattern.js";

export { escapeLikePattern };

const LONDON = "Europe/London";

/**
 * The audit log's filters as one predicate. Free text matches the event type, the entity id and
 * the actor's name or email, never the payload: payload text is redacted for most staff, and a
 * search over it would reveal what the redaction hides.
 */
export function buildAuditLogWhere(input: AuditLogSearchInput): SQL | undefined {
  const clauses: SQL[] = [];

  const text = input.q?.trim();
  if (text) {
    const contains = `%${escapeLikePattern(text)}%`;
    const asEventType = `%${escapeLikePattern(text.toLowerCase().replace(/\s+/g, "_"))}%`;
    const actorMatch = or(
      ilike(bidIdentityDirectory.name, contains),
      ilike(bidIdentityDirectory.email, contains),
    );
    const match = or(
      ilike(domainEvent.eventType, asEventType),
      ilike(domainEvent.aggregateId, contains),
      input.matchClientActors ? actorMatch : and(eq(bidUserProfile.role, "staff"), actorMatch),
    );
    if (match) clauses.push(match);
  }

  if (input.actorUserId) clauses.push(eq(domainEvent.actorUserId, input.actorUserId));
  if (input.aggregateType) clauses.push(eq(domainEvent.aggregateType, input.aggregateType));
  if (input.aggregateId) clauses.push(eq(domainEvent.aggregateId, input.aggregateId));

  const types = input.eventTypes ?? [];
  const prefixes = input.eventTypePrefixes ?? [];
  if (types.length > 0 || prefixes.length > 0) {
    const either = or(
      types.length > 0 ? inArray(domainEvent.eventType, [...types]) : undefined,
      ...prefixes.map((prefix) => ilike(domainEvent.eventType, `${escapeLikePattern(prefix)}%`)),
    );
    if (either) clauses.push(either);
  }

  if (input.fromDay) {
    clauses.push(
      gte(domainEvent.occurredAt, sql`(${input.fromDay}::date)::timestamp at time zone ${LONDON}`),
    );
  }
  if (input.toDay) {
    clauses.push(
      lt(
        domainEvent.occurredAt,
        sql`((${input.toDay}::date) + 1)::timestamp at time zone ${LONDON}`,
      ),
    );
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}
