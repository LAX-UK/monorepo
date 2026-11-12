import type {
  IImpersonationSessionRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { IImpersonationDomainEventReader } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import { ADMIN_IMPERSONATION_AGGREGATE_TYPE } from "@auction/persistence/lib";
import { encodeActingContextCookie } from "@auction/types";
import { parseActingLegalEntityCookieFromHeader } from "../../lib/impersonation-cookie.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  AdminImpersonationLookupResult,
  AdminImpersonationRecordFailedEndResult,
  AdminImpersonationStartResult,
  IAdminImpersonationService,
} from "../interfaces/admin-routes.js";

export class AdminImpersonationService implements IAdminImpersonationService {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly impersonationSessionRepository: IImpersonationSessionRepository,
    private readonly impersonationDomainEventReader: IImpersonationDomainEventReader,
    private readonly domainEventSink: IDomainEventSink,
  ) {}

  async lookupForImpersonation(legalEntityId: string): Promise<AdminImpersonationLookupResult> {
    const entity = await this.legalEntityRepository.findById(legalEntityId);
    if (!entity) return { ok: false, notFound: true };
    return {
      ok: true,
      data: { id: entity.id, displayName: entity.displayName, status: entity.status },
    };
  }

  async startImpersonation(input: {
    actorUserId: string;
    legalEntityId: string;
    cookieHeader: string | undefined;
  }): Promise<AdminImpersonationStartResult> {
    const { actorUserId, legalEntityId, cookieHeader } = input;
    const existingMembership = await this.legalEntityRepository.findActiveMembership(
      actorUserId,
      legalEntityId,
    );
    if (existingMembership) {
      return {
        ok: false,
        status: 400,
        error: "not_impersonation",
        message:
          "You are already a member of this entity; use the standard acting context switcher.",
      };
    }
    const entity = await this.legalEntityRepository.findById(legalEntityId);
    if (!entity) {
      return { ok: false, status: 404, error: "not_found" };
    }
    const prevSessionId = parseActingLegalEntityCookieFromHeader(cookieHeader)?.i?.sid;

    const session = await this.transactionRunner.runInTransaction(async (tx) => {
      const txRepo = this.impersonationSessionRepository.forConnection(tx);
      if (prevSessionId) {
        await this.endOwnedSession(txRepo, tx, {
          sessionId: prevSessionId,
          actorUserId,
          endReason: "session_replaced",
        });
      }
      const row = await txRepo.start(actorUserId, entity.id);
      await this.domainEventSink.withTx(tx).publish({
        aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
        aggregateId: row.id,
        eventType: "admin.impersonation_started",
        payload: {
          impersonating_user_id: actorUserId,
          target_legal_entity_id: entity.id,
          target_legal_entity_display_name: entity.displayName,
          session_id: row.id,
          expires_at: row.expiresAt.toISOString(),
        },
        actorUserId,
        actingLegalEntityId: entity.id,
        schemaVersion: 1,
      });
      return row;
    });

    const actingCookie = encodeActingContextCookie({
      v: 1,
      e: entity.id,
      n: entity.displayName,
      i: { sid: session.id },
    });
    return {
      ok: true,
      data: {
        actingCookie,
        sessionId: session.id,
        expiresAt: session.expiresAt.toISOString(),
        displayName: entity.displayName,
      },
    };
  }

  async endImpersonation(input: {
    actorUserId: string;
    cookieHeader: string | undefined;
  }): Promise<{ ok: true } | { ok: false; error: "no_active_impersonation" }> {
    const sessionId = parseActingLegalEntityCookieFromHeader(input.cookieHeader)?.i?.sid;
    if (!sessionId) return { ok: false, error: "no_active_impersonation" };
    const ended = await this.transactionRunner.runInTransaction((tx) =>
      this.endOwnedSession(this.impersonationSessionRepository.forConnection(tx), tx, {
        sessionId,
        actorUserId: input.actorUserId,
        endReason: "manual",
      }),
    );
    return ended ? { ok: true } : { ok: false, error: "no_active_impersonation" };
  }

  /** Ends the actor's own open session and audits it against the session's real target entity
   * (never the cookie's). A session that is not the actor's, or is already ended, is left alone. */
  private async endOwnedSession(
    sessions: IImpersonationSessionRepository,
    tx: Parameters<IImpersonationSessionRepository["forConnection"]>[0],
    input: {
      sessionId: string;
      actorUserId: string;
      endReason: "manual" | "session_replaced";
    },
  ): Promise<boolean> {
    const row = await sessions.findById(input.sessionId);
    if (!row || row.actorUserId !== input.actorUserId || row.endedAt) return false;
    if (!(await sessions.endForActor(row.id, input.actorUserId, input.endReason))) return false;
    await this.domainEventSink.withTx(tx).publish({
      aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
      aggregateId: row.id,
      eventType: "admin.impersonation_ended",
      payload: { session_id: row.id, end_reason: input.endReason },
      actorUserId: input.actorUserId,
      actingLegalEntityId: row.targetLegalEntityId,
      schemaVersion: 1,
    });
    return true;
  }

  async recordFailedEnd(input: {
    actorUserId: string;
    sessionId: string;
    legalEntityId: string;
  }): Promise<AdminImpersonationRecordFailedEndResult> {
    const { actorUserId, sessionId, legalEntityId } = input;
    const started = await this.impersonationDomainEventReader.findStartedEvent({
      sessionId,
      actorUserId,
    });

    if (!started) {
      return { ok: false, status: 404, error: "session_not_found" };
    }
    if (started.actingLegalEntityId !== legalEntityId) {
      return { ok: false, status: 400, error: "legal_entity_mismatch" };
    }

    if (await this.impersonationDomainEventReader.hasEndedEvent(sessionId)) {
      return { ok: true, alreadyEnded: true };
    }

    const recorded = await this.transactionRunner.runInTransaction(async (tx) => {
      const ended = await this.impersonationSessionRepository
        .forConnection(tx)
        .endForActor(sessionId, actorUserId, "cookie_cleared_after_failed_end");
      if (!ended) return false;
      await this.domainEventSink.withTx(tx).publish({
        aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
        aggregateId: sessionId,
        eventType: "admin.impersonation_ended",
        payload: {
          session_id: sessionId,
          end_reason: "cookie_cleared_after_failed_end",
        },
        actorUserId,
        actingLegalEntityId: legalEntityId,
        schemaVersion: 1,
      });
      return true;
    });
    return recorded ? { ok: true } : { ok: true, alreadyEnded: true };
  }
}
