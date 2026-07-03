import type { Database } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { IImpersonationDomainEventReader } from "../interfaces/impersonation-domain-event.reader.js";
import { ADMIN_IMPERSONATION_AGGREGATE_TYPE } from "../lib/impersonation-audit.constants.js";

export class DrizzleImpersonationDomainEventReader implements IImpersonationDomainEventReader {
  constructor(private readonly db: Database) {}

  async findStartedEvent(input: {
    sessionId: string;
    actorUserId: string;
  }): Promise<{ actingLegalEntityId: string | null } | null> {
    const [started] = await this.db
      .select({
        actingLegalEntityId: domainEvent.actingLegalEntityId,
      })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, ADMIN_IMPERSONATION_AGGREGATE_TYPE),
          eq(domainEvent.aggregateId, input.sessionId),
          eq(domainEvent.eventType, "admin.impersonation_started"),
          eq(domainEvent.actorUserId, input.actorUserId),
        ),
      )
      .limit(1);
    return started ?? null;
  }

  async hasEndedEvent(sessionId: string): Promise<boolean> {
    const [ended] = await this.db
      .select({ id: domainEvent.id })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, ADMIN_IMPERSONATION_AGGREGATE_TYPE),
          eq(domainEvent.aggregateId, sessionId),
          eq(domainEvent.eventType, "admin.impersonation_ended"),
        ),
      )
      .limit(1);
    return Boolean(ended);
  }

  async listRecentStartedForActor(actorUserId: string, limit: number) {
    return this.db
      .select({
        aggregateId: domainEvent.aggregateId,
        actingLegalEntityId: domainEvent.actingLegalEntityId,
      })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, ADMIN_IMPERSONATION_AGGREGATE_TYPE),
          eq(domainEvent.eventType, "admin.impersonation_started"),
          eq(domainEvent.actorUserId, actorUserId),
        ),
      )
      .orderBy(desc(domainEvent.id))
      .limit(limit);
  }
}
