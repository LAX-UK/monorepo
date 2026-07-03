import type { Database } from "@auction/db";
import { impersonationSession } from "@auction/db/schema";
import { IMPERSONATION_TTL_MS } from "@auction/types";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type {
  IImpersonationSessionRepository,
  ImpersonationDbClient,
  ImpersonationEndReason,
  ImpersonationSessionRow,
} from "./interfaces/impersonation-session.repository.js";

export class DrizzleImpersonationSessionRepository implements IImpersonationSessionRepository {
  constructor(private readonly db: Database) {}

  forConnection(conn: Database): IImpersonationSessionRepository {
    return new DrizzleImpersonationSessionRepository(conn);
  }

  async start(
    actorUserId: string,
    targetLegalEntityId: string,
    client: ImpersonationDbClient = this.db,
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
    client: ImpersonationDbClient = this.db,
  ): Promise<void> {
    await client
      .update(impersonationSession)
      .set({ endedAt: new Date(), endReason })
      .where(and(eq(impersonationSession.id, sessionId), isNull(impersonationSession.endedAt)));
  }

  async findById(sessionId: string): Promise<ImpersonationSessionRow | null> {
    const [row] = await this.db
      .select()
      .from(impersonationSession)
      .where(eq(impersonationSession.id, sessionId))
      .limit(1);
    return row ?? null;
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
}
