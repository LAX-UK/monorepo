import type {
  IImpersonationSessionRepository,
  ImpersonationEndReason,
  ImpersonationSessionRow,
} from "../repositories/interfaces/impersonation-session.repository.js";

export type { ImpersonationEndReason, ImpersonationSessionRow };

function normalizeEndReason(reason: string): ImpersonationEndReason {
  switch (reason) {
    case "manual":
    case "timeout":
    case "timeout_swept":
    case "session_replaced":
    case "cookie_cleared_after_failed_end":
    case "force_ended":
      return reason;
    default:
      return "force_ended";
  }
}

export type ImpersonationSessionValidation =
  | { ok: true; session: ImpersonationSessionRow }
  | { ok: false; reason: "not_found" | "actor_mismatch" | "entity_mismatch" | "ended" | "expired" };

export class ImpersonationSessionService {
  constructor(private readonly repo: IImpersonationSessionRepository) {}

  async start(
    actorUserId: string,
    targetLegalEntityId: string,
    client?: Parameters<IImpersonationSessionRepository["start"]>[2],
  ): Promise<ImpersonationSessionRow> {
    return this.repo.start(actorUserId, targetLegalEntityId, client);
  }

  async end(
    sessionId: string,
    endReason: ImpersonationEndReason,
    client?: Parameters<IImpersonationSessionRepository["end"]>[2],
  ): Promise<void> {
    await this.repo.end(sessionId, endReason, client);
  }

  async forceEnd(sessionId: string, _byAdminUserId: string, reason: string): Promise<void> {
    await this.end(sessionId, normalizeEndReason(reason || "force_ended"));
  }

  async findActive(sessionId: string): Promise<ImpersonationSessionRow | null> {
    return this.repo.findActive(sessionId);
  }

  async listActiveByActor(actorUserId: string): Promise<ImpersonationSessionRow[]> {
    return this.repo.listActiveByActor(actorUserId);
  }

  async validateForRequest(input: {
    sessionId: string;
    actorUserId: string;
    targetLegalEntityId: string;
  }): Promise<ImpersonationSessionValidation> {
    const row = await this.repo.findById(input.sessionId);
    if (!row) return { ok: false, reason: "not_found" };
    if (row.actorUserId !== input.actorUserId) return { ok: false, reason: "actor_mismatch" };
    if (row.targetLegalEntityId !== input.targetLegalEntityId) {
      return { ok: false, reason: "entity_mismatch" };
    }
    if (row.endedAt) return { ok: false, reason: "ended" };
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.end(row.id, "timeout");
      return { ok: false, reason: "expired" };
    }
    return { ok: true, session: row };
  }
}
