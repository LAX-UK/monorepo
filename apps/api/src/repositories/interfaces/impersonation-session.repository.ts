import type { Database } from "@auction/db";
import type { impersonationSession } from "@auction/db/schema";

export type ImpersonationSessionRow = typeof impersonationSession.$inferSelect;

export type ImpersonationEndReason =
  | "manual"
  | "timeout"
  | "timeout_swept"
  | "session_replaced"
  | "cookie_cleared_after_failed_end"
  | "force_ended";

/** Root pool or Drizzle transaction client (same insert/update surface). */
export type ImpersonationDbClient = Database;

export interface IImpersonationSessionRepository {
  forConnection(conn: Database): IImpersonationSessionRepository;
  start(
    actorUserId: string,
    targetLegalEntityId: string,
    client?: ImpersonationDbClient,
  ): Promise<ImpersonationSessionRow>;
  end(
    sessionId: string,
    endReason: ImpersonationEndReason,
    client?: ImpersonationDbClient,
  ): Promise<void>;
  findById(sessionId: string): Promise<ImpersonationSessionRow | null>;
  findActive(sessionId: string): Promise<ImpersonationSessionRow | null>;
  listActiveByActor(actorUserId: string): Promise<ImpersonationSessionRow[]>;
}
