import type { IdentityDatabase } from "@auction/identity-db";
import { oidcRpSession, session, sessionLineage } from "@auction/identity-db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import type { Redis } from "ioredis";
import type {
  OidcCodeCorrelationStore,
  OidcRpSessionRepository,
} from "../services/oidc-session-coordinator.js";
import { sessionIsLive } from "./session-lifetime.sql.js";

const CORRELATION_KEY_PREFIX = "oidc:authorization-session:";

export class RedisOidcCodeCorrelationStore implements OidcCodeCorrelationStore {
  constructor(private readonly redis: Redis) {}

  async putIfAbsent(codeHash: string, identitySessionId: string, ttlSec: number): Promise<boolean> {
    return (
      (await this.redis.set(
        `${CORRELATION_KEY_PREFIX}${codeHash}`,
        identitySessionId,
        "EX",
        ttlSec,
        "NX",
      )) === "OK"
    );
  }

  async peek(codeHash: string): Promise<string | null> {
    return this.redis.get(`${CORRELATION_KEY_PREFIX}${codeHash}`);
  }

  async finalize(codeHash: string): Promise<void> {
    await this.redis.del(`${CORRELATION_KEY_PREFIX}${codeHash}`);
  }
}

export class DrizzleOidcRpSessionRepository implements OidcRpSessionRepository {
  constructor(private readonly db: IdentityDatabase) {}

  async findIdentitySession(identitySessionId: string) {
    const [row] = await this.db
      .select({
        id: session.id,
        subjectId: session.userId,
        createdAt: session.createdAt,
        lastPasswordAuthAt: session.lastPasswordAuthAt,
        mfaCompletedAt: session.mfaCompletedAt,
        socialAuthAt: session.socialAuthAt,
        lastStepUpAt: session.lastStepUpAt,
        amr: session.amr,
      })
      .from(session)
      .where(eq(session.id, identitySessionId))
      .limit(1);
    return row ?? null;
  }

  /**
   * The Identity session behind `sid` while it is still signed in (not ended, expired, idle too long or signed in too long). A `sid`
   * that a newer sign-in in the same browser took over resolves to the record that replaced it.
   */
  async findLiveIdentitySession(identitySessionId: string, now: Date) {
    const [row] = await this.db
      .select({
        id: session.id,
        subjectId: session.userId,
        createdAt: session.createdAt,
        lastPasswordAuthAt: session.lastPasswordAuthAt,
        mfaCompletedAt: session.mfaCompletedAt,
        amr: session.amr,
      })
      .from(session)
      .where(
        and(
          or(
            eq(session.id, identitySessionId),
            inArray(
              session.id,
              this.db
                .select({ sessionId: sessionLineage.sessionId })
                .from(sessionLineage)
                .where(eq(sessionLineage.previousSid, identitySessionId)),
            ),
          ),
          sessionIsLive(now),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async upsertRpSession(input: {
    clientId: string;
    subjectId: string;
    sid: string;
    identitySessionId: string;
    seenAt: Date;
  }): Promise<void> {
    await this.db
      .insert(oidcRpSession)
      .values({
        clientId: input.clientId,
        subjectId: input.subjectId,
        sid: input.sid,
        identitySessionId: input.identitySessionId,
        createdAt: input.seenAt,
        updatedAt: input.seenAt,
        lastSeenAt: input.seenAt,
        revokedAt: null,
      })
      .onConflictDoUpdate({
        target: [oidcRpSession.clientId, oidcRpSession.sid],
        set: {
          subjectId: input.subjectId,
          identitySessionId: input.identitySessionId,
          updatedAt: input.seenAt,
          lastSeenAt: input.seenAt,
          revokedAt: null,
        },
      });
  }
}
