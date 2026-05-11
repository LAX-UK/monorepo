import type { Database } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import { encodeActingContextCookie } from "@auction/types";
import { and, eq } from "drizzle-orm";
import { parseActingLegalEntityCookieFromHeader } from "../../lib/impersonation-cookie.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import { ADMIN_IMPERSONATION_AGGREGATE_TYPE } from "../impersonation-audit.service.js";
import type { ImpersonationSessionService } from "../impersonation-session.service.js";
import type {
  AdminImpersonationLookupResult,
  AdminImpersonationRecordFailedEndResult,
  AdminImpersonationStartResult,
  IAdminImpersonationService,
} from "../interfaces/admin-routes.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";

export class AdminImpersonationService implements IAdminImpersonationService {
  constructor(
    private readonly db: Database,
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly impersonationSessionService: ImpersonationSessionService,
    private readonly domainEventPublisher: DomainEventPublisher,
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
    const prev = parseActingLegalEntityCookieFromHeader(cookieHeader);
    const prevSessionId = prev?.i?.sid;
    const prevEntityId = prev?.e;

    const session = await this.db.transaction(async (tx) => {
      if (prevSessionId && prevEntityId) {
        await this.impersonationSessionService.end(prevSessionId, "session_replaced", tx);
        await this.domainEventPublisher.publish(tx, {
          aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
          aggregateId: prevSessionId,
          eventType: "admin.impersonation_ended",
          payload: {
            session_id: prevSessionId,
            end_reason: "session_replaced",
          },
          actorUserId,
          actingLegalEntityId: prevEntityId,
          schemaVersion: 1,
        });
      }
      const row = await this.impersonationSessionService.start(actorUserId, entity.id, tx);
      await this.domainEventPublisher.publish(tx, {
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
    const cookiePayload = parseActingLegalEntityCookieFromHeader(input.cookieHeader);
    const imp = cookiePayload?.i;
    if (!imp?.sid || !cookiePayload?.e) {
      return { ok: false, error: "no_active_impersonation" };
    }
    await this.db.transaction(async (tx) => {
      await this.impersonationSessionService.end(imp.sid, "manual", tx);
      await this.domainEventPublisher.publish(tx, {
        aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
        aggregateId: imp.sid,
        eventType: "admin.impersonation_ended",
        payload: {
          session_id: imp.sid,
          end_reason: "manual",
        },
        actorUserId: input.actorUserId,
        actingLegalEntityId: cookiePayload.e,
        schemaVersion: 1,
      });
    });
    return { ok: true };
  }

  async recordFailedEnd(input: {
    actorUserId: string;
    sessionId: string;
    legalEntityId: string;
  }): Promise<AdminImpersonationRecordFailedEndResult> {
    const { actorUserId, sessionId, legalEntityId } = input;
    const [started] = await this.db
      .select({
        id: domainEvent.id,
        actingLegalEntityId: domainEvent.actingLegalEntityId,
      })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, ADMIN_IMPERSONATION_AGGREGATE_TYPE),
          eq(domainEvent.aggregateId, sessionId),
          eq(domainEvent.eventType, "admin.impersonation_started"),
          eq(domainEvent.actorUserId, actorUserId),
        ),
      )
      .limit(1);

    if (!started) {
      return { ok: false, status: 404, error: "session_not_found" };
    }
    if (started.actingLegalEntityId !== legalEntityId) {
      return { ok: false, status: 400, error: "legal_entity_mismatch" };
    }

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

    if (ended) {
      return { ok: true, alreadyEnded: true };
    }

    await this.db.transaction(async (tx) => {
      await this.impersonationSessionService.end(sessionId, "cookie_cleared_after_failed_end", tx);
      await this.domainEventPublisher.publish(tx, {
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
    });
    return { ok: true };
  }
}
