import type { Database } from "@auction/db";
import { impersonationSession } from "@auction/db/schema";
import { IMPERSONATION_TTL_MS } from "@auction/types";
import { and, desc, eq, gt, isNull } from "drizzle-orm";

/** Root pool or Drizzle transaction client (same insert/update surface). */
type DbClient = Database;

export type ImpersonationSessionRow = typeof impersonationSession.$inferSelect;
export type ImpersonationEndReason =
  | "manual"
  | "timeout"
  | "timeout_swept"
  | "session_replaced"
  | "cookie_cleared_after_failed_end"
  | "force_ended";

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
  constructor(private readonly db: Database) {}

  async start(
    actorUserId: string,
    targetLegalEntityId: string,
    client: DbClient = this.db,
  ): Promise<ImpersonationSessionRow> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + IMPERSONATION_TTL_MS);
    const [row] = await client
      .insert(impersonationSession)
      .values({
        actorUserId,
        targetLegalEntityId,
        startedAt: now,
        expiresAt,
      })
      .returning();
    if (!row) throw new Error("impersonation_session_create_failed");
    return row;
  }

  async end(
    sessionId: string,
    endReason: ImpersonationEndReason,
    client: DbClient = this.db,
  ): Promise<void> {
    await client
      .update(impersonationSession)
      .set({ endedAt: new Date(), endReason })
      .where(and(eq(impersonationSession.id, sessionId), isNull(impersonationSession.endedAt)));
  }

  async forceEnd(sessionId: string, _byAdminUserId: string, reason: string): Promise<void> {
    await this.end(sessionId, normalizeEndReason(reason || "force_ended"));
  }

  async findActive(sessionId: string): Promise<ImpersonationSessionRow | null> {
    const [row] = await this.db
      .select()
      .from(impersonationSession)
      .where(
        and(
          eq(impersonationSession.id, sessionId),
          isNull(impersonationSession.endedAt),
          gt(impersonationSession.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listActiveByActor(actorUserId: string): Promise<ImpersonationSessionRow[]> {
    return this.db
      .select()
      .from(impersonationSession)
      .where(
        and(
          eq(impersonationSession.actorUserId, actorUserId),
          isNull(impersonationSession.endedAt),
          gt(impersonationSession.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(impersonationSession.startedAt));
  }

  async validateForRequest(input: {
    sessionId: string;
    actorUserId: string;
    targetLegalEntityId: string;
  }): Promise<ImpersonationSessionValidation> {
    const [row] = await this.db
      .select()
      .from(impersonationSession)
      .where(eq(impersonationSession.id, input.sessionId))
      .limit(1);
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
