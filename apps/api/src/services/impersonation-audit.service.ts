import type {
  IImpersonationDomainEventReader,
  IImpersonationSessionRepository,
  ITransactionRunner,
  ImpersonationEndReason,
} from "@auction/persistence/interfaces";
import { ADMIN_IMPERSONATION_AGGREGATE_TYPE } from "@auction/persistence/lib";
import { parseActingLegalEntityCookieFromHeader } from "../lib/impersonation-cookie.js";
import type { IDomainEventSink } from "./domain-event-sink.js";

export { ADMIN_IMPERSONATION_AGGREGATE_TYPE };

export class ImpersonationAuditService {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly impersonationDomainEventReader: IImpersonationDomainEventReader,
    private readonly publisher: IDomainEventSink,
    private readonly impersonationSessions: Pick<
      IImpersonationSessionRepository,
      "listActiveByActor" | "findById" | "endForActor" | "forConnection"
    >,
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

      await this.publisher.withTx(tx).publish({
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

  /** On each platform-admin request, align audit state with the acting cookie, so the audit log
   * and the session row always agree:
   * - a cookie for one of the actor's live sessions changes nothing;
   * - a cookie for the actor's own expired session ends it with `timeout`;
   * - otherwise (no cookie, or a foreign or stale one) the actor's latest session that is no
   *   longer live and still open is ended with `cookie_cleared_after_failed_end`. A session that
   *   is still live is left alone: it may be open in another browser.
   */
  async reconcileFromAdminRequestCookie(input: {
    actorUserId: string;
    cookieHeader: string | undefined;
  }): Promise<void> {
    const { actorUserId } = input;
    const sid = parseActingLegalEntityCookieFromHeader(input.cookieHeader)?.i?.sid;
    const liveIds = new Set(
      (await this.impersonationSessions.listActiveByActor(actorUserId)).map((s) => s.id),
    );
    if (sid && liveIds.has(sid)) return;

    if (sid) {
      const own = await this.impersonationSessions.findById(sid);
      if (own && own.actorUserId === actorUserId && !own.endedAt) {
        // Open but not live, so it has expired.
        await this.endAndRecord({
          sessionId: own.id,
          actorUserId,
          actingLegalEntityId: own.targetLegalEntityId,
          endReason: "timeout",
        });
        return;
      }
    }

    await this.recordLatestOpenSessionAsCookieCleared(actorUserId, liveIds);
  }

  private async recordLatestOpenSessionAsCookieCleared(
    actorUserId: string,
    liveIds: ReadonlySet<string>,
  ): Promise<void> {
    const starters = await this.impersonationDomainEventReader.listRecentStartedForActor(
      actorUserId,
      40,
    );

    for (const row of starters) {
      if (liveIds.has(row.aggregateId)) continue;
      if (await this.impersonationDomainEventReader.hasEndedEvent(row.aggregateId)) continue;

      const recorded = await this.endAndRecord({
        sessionId: row.aggregateId,
        actorUserId,
        actingLegalEntityId: row.actingLegalEntityId,
        endReason: "cookie_cleared_after_failed_end",
      });
      if (recorded) return;
    }
  }

  /** Ends the actor's open session and records the end in one transaction. Returns false when
   * the session was not the actor's, was already ended, or already has an end event. */
  private async endAndRecord(input: {
    sessionId: string;
    actorUserId: string;
    actingLegalEntityId: string | null;
    endReason: ImpersonationEndReason;
  }): Promise<boolean> {
    return this.transactionRunner.runInTransaction(async (tx) => {
      if (await this.impersonationDomainEventReader.hasEndedEvent(input.sessionId)) return false;
      const sessions = this.impersonationSessions.forConnection(tx);
      if (!(await sessions.endForActor(input.sessionId, input.actorUserId, input.endReason))) {
        return false;
      }
      await this.publisher.withTx(tx).publish({
        aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
        aggregateId: input.sessionId,
        eventType: "admin.impersonation_ended",
        payload: { session_id: input.sessionId, end_reason: input.endReason },
        actorUserId: input.actorUserId,
        actingLegalEntityId: input.actingLegalEntityId,
        schemaVersion: 1,
      });
      return true;
    });
  }
}
