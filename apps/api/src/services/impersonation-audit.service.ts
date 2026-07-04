import {
  ADMIN_IMPERSONATION_AGGREGATE_TYPE,
  type IImpersonationDomainEventReader,
  type ITransactionRunner,
} from "@auction/persistence";
import { parseActingLegalEntityCookieFromHeader } from "../lib/impersonation-cookie.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";

export { ADMIN_IMPERSONATION_AGGREGATE_TYPE };

export class ImpersonationAuditService {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly impersonationDomainEventReader: IImpersonationDomainEventReader,
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
    await this.transactionRunner.runInTransaction(async (tx) => {
      if (await this.impersonationDomainEventReader.hasEndedEvent(input.sessionId)) return;

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
    const starters = await this.impersonationDomainEventReader.listRecentStartedForActor(
      actorUserId,
      40,
    );

    for (const row of starters) {
      if (await this.impersonationDomainEventReader.hasEndedEvent(row.aggregateId)) continue;

      await this.transactionRunner.runInTransaction(async (tx) => {
        if (await this.impersonationDomainEventReader.hasEndedEvent(row.aggregateId)) return;

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
