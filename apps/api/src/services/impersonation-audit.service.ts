import type { Database } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { parseActingLegalEntityCookieFromHeader } from "../lib/impersonation-cookie.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";

export const ADMIN_IMPERSONATION_AGGREGATE_TYPE = "admin_impersonation";

export class ImpersonationAuditService {
  constructor(
    private readonly db: Database,
    private readonly publisher: DomainEventPublisher,
  ) {}

  /** Idempotent: skips if an `admin.impersonation_ended` row already exists for
   * this session aggregate.
   */
  async recordSessionTimedOut(input: {
    sessionId: string;
    actorUserId: string;
    actingLegalEntityId: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const ended = await tx
        .select({ id: domainEvent.id })
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.aggregateType, ADMIN_IMPERSONATION_AGGREGATE_TYPE),
            eq(domainEvent.aggregateId, input.sessionId),
            eq(domainEvent.eventType, "admin.impersonation_ended"),
          ),
        )
        .limit(1);
      if (ended[0]) return;

      await this.publisher.publish(tx, {
        aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
        aggregateId: input.sessionId,
        eventType: "admin.impersonation_ended",
        payload: {
          session_id: input.sessionId,
          end_reason: "timeout",
        },
        actorUserId: input.actorUserId,
        actingLegalEntityId: input.actingLegalEntityId,
        schemaVersion: 1,
      });
    });
  }

  /** on each platform-admin request, align audit state with the
   * acting cookie — expired sessions get `timeout`; if the cookie is absent but
   * the DB still has an open impersonation aggregate for this actor, emit
   * `admin.impersonation_ended` with `cookie_cleared_after_failed_end` (covers
   * failed `record-failed-end` after the browser cleared the cookie).
   */
  async reconcileFromAdminRequestCookie(input: {
    actorUserId: string;
    cookieHeader: string | undefined;
  }): Promise<void> {
    const payload = parseActingLegalEntityCookieFromHeader(input.cookieHeader);
    if (payload?.i?.sid && payload.e) {
      return;
    }

    await this.recordLatestOpenSessionAsCookieCleared(input.actorUserId);
  }

  private async recordLatestOpenSessionAsCookieCleared(actorUserId: string): Promise<void> {
    const starters = await this.db
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
      .limit(40);

    for (const row of starters) {
      const [ended] = await this.db
        .select({ id: domainEvent.id })
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.aggregateType, ADMIN_IMPERSONATION_AGGREGATE_TYPE),
            eq(domainEvent.aggregateId, row.aggregateId),
            eq(domainEvent.eventType, "admin.impersonation_ended"),
          ),
        )
        .limit(1);
      if (ended) continue;

      await this.db.transaction(async (tx) => {
        const [ended2] = await tx
          .select({ id: domainEvent.id })
          .from(domainEvent)
          .where(
            and(
              eq(domainEvent.aggregateType, ADMIN_IMPERSONATION_AGGREGATE_TYPE),
              eq(domainEvent.aggregateId, row.aggregateId),
              eq(domainEvent.eventType, "admin.impersonation_ended"),
            ),
          )
          .limit(1);
        if (ended2) return;

        await this.publisher.publish(tx, {
          aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
          aggregateId: row.aggregateId,
          eventType: "admin.impersonation_ended",
          payload: {
            session_id: row.aggregateId,
            end_reason: "cookie_cleared_after_failed_end",
          },
          actorUserId,
          actingLegalEntityId: row.actingLegalEntityId,
          schemaVersion: 1,
        });
      });
      return;
    }
  }
}
